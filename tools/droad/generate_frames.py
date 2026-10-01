"""
Dlicom Road - mascot animation frame generator.

Usage:
    python3 tools/droad/generate_frames.py

Outputs
-------
assets/droad/animations/mascot-<state>/frame-NN.png   1024x1024 RGBA masters
assets/droad/vehicles/vehicle-NN.png                  512x512 RGBA
public/droad/animations/mascot-<state>.webp           horizontal sprite sheet
public/droad/vehicles/vehicle-NN.webp                 runtime vehicle
public/games/dlicomroad.webp                          lobby tile

Every frame is a warp of the original mascot.png pixels, so the character
design is never altered. Frames share one canvas, one scale, one anchor
(centre-bottom) and one camera.
"""

import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import mascot_rig as rig  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC_MASCOT = os.path.join(ROOT, "assets", "droad", "mascot.png")
ASSET_ANIM = os.path.join(ROOT, "assets", "droad", "animations")
ASSET_VEH = os.path.join(ROOT, "assets", "droad", "vehicles")
PUBLIC = os.path.join(ROOT, "public", "droad")
PUBLIC_ANIM = os.path.join(PUBLIC, "animations")
PUBLIC_VEH = os.path.join(PUBLIC, "vehicles")

MASTER = rig.CANVAS            # 1280x1280 authored frames
# Shipped cell is square so the runtime can size the mascot from a single number.
# 800/1280 of the cell is the standing mascot, i.e. 280px of visible sprite.
RUNTIME_CELL = 448
# 78 keeps the mascot's flat colour edges clean while holding the whole set of
# five sheets to roughly 1MB, which matters on mobile.
SHEET_QUALITY = 78
# --sheets re-encodes the runtime sheets from the authored frames, skipping the
# (slow) warp pass. Only use it after the poses themselves are final.
SHEETS_ONLY = "--sheets" in sys.argv


# ==========================================================================
# Stage: compose the mascot once into the shared canvas
# ==========================================================================
def build_stage():
    src = Image.open(SRC_MASCOT).convert("RGBA")
    stage = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    s = rig._scale
    size = (max(1, round((rig.SRC_BBOX[2] - rig.SRC_BBOX[0]) * s)),
            max(1, round((rig.SRC_BBOX[3] - rig.SRC_BBOX[1]) * s)))
    crop = src.crop(rig.SRC_BBOX).resize(size, Image.LANCZOS)
    stage.alpha_composite(crop, (round(rig.X_OFFSET), round(rig.GROUND_Y - size[1])))
    return stage


# ==========================================================================
# Warp
# ==========================================================================
MESH_CELL = 32  # 32x32 px quads -> sub-pixel accurate, 1600 quads per frame


def _forward(pose_d, px, py):
    """Forward map: canvas px -> deformed canvas px."""
    dx, dy = rig.displacement(pose_d, px / MASTER, py / MASTER)
    return px + dx * MASTER, py + dy * MASTER


def _seed(pose_d, tx, ty):
    """Initial guess for the mesh inverse.

    Starting Newton at the identity means a pose that rotates the mascot by 100
    degrees has to walk ~800px before it finds the right root. Inverting the
    pose's dominant (body) transform first puts the guess within a few pixels.
    """
    xf = pose_d.get("body")
    if xf is None or xf.identity:
        return tx.copy(), ty.copy()
    nx, ny = tx / MASTER, ty / MASTER
    px, py = xf.invert(nx, ny)
    return px * MASTER, py * MASTER


def _inverse(pose_d, tx, ty, iters=40):
    """Newton inverse of _forward.

    Elements are solved independently: an element stops moving once its
    residual is sub-pixel, and only elements whose full Newton step makes
    things worse fall back to a damped step. This keeps a handful of awkward
    cells from poisoning the whole sheet.
    """
    px, py = _seed(pose_d, tx, ty)
    h = 2.0
    fx, fy = _forward(pose_d, px, py)
    err = np.maximum(np.abs(fx - tx), np.abs(fy - ty))
    for _ in range(iters):
        live = err > 0.02
        if not live.any():
            break
        lx, ly = px[live], py[live]
        ltx, lty = tx[live], ty[live]
        xh0, xh1 = _forward(pose_d, lx + h, ly)
        xm0, xm1 = _forward(pose_d, lx - h, ly)
        yh0, yh1 = _forward(pose_d, lx, ly + h)
        ym0, ym1 = _forward(pose_d, lx, ly - h)
        j11 = (xh0 - xm0) / (2 * h)
        j12 = (yh0 - ym0) / (2 * h)
        j21 = (xh1 - xm1) / (2 * h)
        j22 = (yh1 - ym1) / (2 * h)
        det = j11 * j22 - j12 * j21
        rx, ry = fx[live] - ltx, fy[live] - lty
        ok = np.abs(det) > 1e-6
        det = np.where(ok, det, 1.0)
        stepx = (j22 * rx - j12 * ry) / det
        stepy = (-j21 * rx + j11 * ry) / det
        stepx = np.where(ok, stepx, rx * 0.25)
        stepy = np.where(ok, stepy, ry * 0.25)
        stepx = np.clip(stepx, -2048.0, 2048.0)
        stepy = np.clip(stepy, -2048.0, 2048.0)
        lam = np.ones_like(stepx)
        for _ in range(8):
            npx, npy = lx - lam * stepx, ly - lam * stepy
            nfx, nfy = _forward(pose_d, npx, npy)
            nerr = np.maximum(np.abs(nfx - ltx), np.abs(nfy - lty))
            better = nerr < err[live]
            lx = np.where(better, npx, lx)
            ly = np.where(better, npy, ly)
            err[live] = np.where(better, nerr, err[live])
            lam = np.where(better, 1.0, lam * 0.35)
            if (lam >= 1.0).all():
                break
        px[live] = lx
        py[live] = ly
    return px, py


def _check_pose(pose_d, label):
    """Fail loudly if a pose would emit broken art.

    Three guarantees: the forward field is injective, the deformed silhouette
    still fits the canvas, and every mesh cell that actually lands on the mascot
    has a converged inverse (cells off the mascot legitimately have none).
    """
    stage = build_stage()
    a = np.array(stage)[:, :, 3]
    ys, xs = np.where(a > 64)

    det = rig.min_jacobian(pose_d, xs / MASTER, ys / MASTER)
    if det.min() <= 0.05:
        raise SystemExit(
            f"pose {label}: forward field folds (det min {det.min():.4f})")

    dx, dy = rig.displacement(pose_d, xs / MASTER, ys / MASTER)
    ox, oy = xs + dx * MASTER, ys + dy * MASTER
    box = (ox.min(), ox.max(), oy.min(), oy.max())
    if box[0] < 4 or box[1] > MASTER - 5 or box[2] < 4 or box[3] > MASTER - 5:
        raise SystemExit(
            f"pose {label}: silhouette leaves canvas x[{box[0]:.0f},{box[1]:.0f}] "
            f"y[{box[2]:.0f},{box[3]:.0f}]")

    n = MASTER // MESH_CELL
    t = (np.arange(n) * MESH_CELL).astype(np.float64)
    TX, TY = np.meshgrid(t, t, indexing="xy")
    px, py = _inverse(pose_d, TX, TY)
    fx, fy = _forward(pose_d, px, py)
    res = np.maximum(np.abs(fx - TX), np.abs(fy - TY))

    # A cell matters only if its solved source lands on the mascot; cells that
    # sample empty space legitimately have no inverse at all.
    s_i = np.clip(np.rint(px).astype(int), 0, MASTER - 1)
    s_j = np.clip(np.rint(py).astype(int), 0, MASTER - 1)
    covered = a[s_j, s_i] > 8
    if covered.any():
        worst = res[covered].max()
        if worst > 1.0:
            raise SystemExit(
                f"pose {label}: mesh inverse unconverged on mascot "
                f"({int(covered.sum())} cells, residual {worst:.2f}px)")
    if not covered.any():
        raise SystemExit(f"pose {label}: mesh inverse found no mascot cells")


def warp(stage, pose_d, label=""):
    """Piecewise-affine warp of the stage through the rig displacement field."""
    n = MASTER // MESH_CELL
    tx = (np.arange(n) * MESH_CELL).astype(np.float64)
    TX, TY = np.meshgrid(tx, tx, indexing="xy")

    px, py = _inverse(pose_d, TX, TY)

    data = []
    for i in range(n):
        for j in range(n):
            quad = (px[i, j], py[i, j],
                    px[i, j] + MESH_CELL, py[i, j],
                    px[i, j] + MESH_CELL, py[i, j] + MESH_CELL,
                    px[i, j], py[i, j] + MESH_CELL)
            data.append((
                [j * MESH_CELL, i * MESH_CELL,
                 (j + 1) * MESH_CELL, (i + 1) * MESH_CELL],
                [float(c) for c in quad],
            ))
    return stage.transform((MASTER, MASTER), Image.MESH, data, Image.BILINEAR)


# ==========================================================================
# Animation definitions
# ==========================================================================
Xf = rig.Xf
P = rig.PARTS
TAU = math.pi * 2


def _run_pose(t):
    """Front-facing run cycle, t in [0,1) -> one full 2-stride loop."""
    ph = TAU * 2.0 * t
    bounce = -16.0 + 7.0 * math.cos(ph)
    lean = 6.0 + 1.4 * math.sin(ph)
    body = Xf(P["body"]["pivot"], angle=lean, sx=1.0 - 0.020 * math.cos(ph + 0.6),
              sy=1.0 + 0.030 * math.cos(ph + 0.6), dy=bounce)
    head = Xf(P["head"]["pivot"], angle=-2.6 * math.sin(ph + 0.8),
              dy=-3.0 * math.sin(ph + 0.8), sx=1.0 + 0.010 * math.cos(ph + 0.8))
    crest = Xf(P["crest"]["pivot"], angle=-4.5 * math.sin(ph + 1.6),
               dy=-3.5 * math.sin(ph + 1.6))
    swing = math.sin(ph)
    wing_r = Xf(P["wing_r"]["pivot"], angle=24.0 * swing, dy=-6.0 * max(0.0, -swing),
                sy=1.0 - 0.05 * abs(swing))
    wing_l = Xf(P["wing_l"]["pivot"], angle=-24.0 * swing, dy=-6.0 * max(0.0, swing),
                sy=1.0 - 0.05 * abs(swing))
    leg_l = Xf(P["leg_l"]["pivot"], angle=7.0 * swing, dy=-19.0 * max(0.0, swing),
               dx=5.0 * swing, sy=1.0 - 0.05 * max(0.0, swing))
    leg_r = Xf(P["leg_r"]["pivot"], angle=-7.0 * swing, dy=-19.0 * max(0.0, -swing),
               dx=-5.0 * swing, sy=1.0 - 0.05 * max(0.0, -swing))
    return rig.pose(body, head, crest, wing_r, wing_l, leg_l, leg_r)


def idle(frame_count):
    frames = []
    for i in range(frame_count):
        t = i / frame_count
        a = TAU * t
        lift = math.sin(a) ** 2                       # two soft pulses per loop
        body = Xf(P["body"]["pivot"], angle=1.5 * math.sin(a + 0.4),
                  sx=1.0 - 0.013 * math.sin(a), sy=1.0 + 0.022 * math.sin(a),
                  dy=-10.0 * lift)
        head = Xf(P["head"]["pivot"], angle=-2.2 * math.sin(a + 1.1),
                  dy=-4.0 * math.sin(a + 0.6), sx=1.0 + 0.008 * math.sin(a + 0.6))
        crest = Xf(P["crest"]["pivot"], angle=-3.0 * math.sin(a + 1.9),
                   dy=-2.5 * math.sin(a + 1.4))
        wing_r = Xf(P["wing_r"]["pivot"], angle=3.6 * math.sin(a + 0.9),
                    dy=-1.5 * max(0.0, math.sin(a + 0.9)))
        wing_l = Xf(P["wing_l"]["pivot"], angle=-3.2 * math.sin(a + 1.4),
                    dy=-1.5 * max(0.0, math.sin(a + 1.4)))
        frames.append(rig.pose(body, head, crest, wing_r, wing_l))
    return frames


def run(frame_count):
    return [_run_pose(i / frame_count) for i in range(frame_count)]


def step(frame_count):
    """RUN -> plant -> hop forward -> land -> recover. Plays once.

    Vertical amplitudes stay inside the 80px of headroom above the crest that
    build_stage() reserves, so no frame is ever clipped by the canvas edge.
    """
    keys = [
        dict(bang=3.0,  sx=1.010, sy=0.945, dy=6.0,  hang=2.0,  cang=-2.0, wr=6.0,  wl=-6.0,
             l1=(-2.0, 0.0), l2=(0.0, 0.0)),
        dict(bang=4.0,  sx=1.020, sy=0.918, dy=11.0, hang=3.5,  cang=-3.5, wr=10.0, wl=-10.0,
             l1=(-4.0, 1.5), l2=(0.0, -1.5)),
        dict(bang=8.0,  sx=0.975, sy=1.060, dy=-18.0, hang=2.0, cang=-5.0, wr=-14.0, wl=14.0,
             l1=(-16.0, -6.0), l2=(-15.0, 7.0)),
        dict(bang=6.5,  sx=0.990, sy=1.030, dy=-28.0, hang=-1.0, cang=-7.0, wr=-20.0, wl=20.0,
             l1=(-11.0, -9.0), l2=(-10.0, 10.0)),
        dict(bang=4.0,  sx=1.005, sy=1.000, dy=-16.0, hang=0.5,  cang=-4.0, wr=-8.0,  wl=9.0,
             l1=(2.0, -5.0), l2=(-14.0, 9.0)),
        dict(bang=-2.5, sx=1.070, sy=0.898, dy=9.0,   hang=-2.0, cang=-1.0, wr=12.0, wl=-12.0,
             l1=(-2.0, 2.0), l2=(0.0, -3.0)),
        dict(bang=0.0,  sx=1.015, sy=0.975, dy=2.0,  hang=0.0,  cang=0.0,  wr=4.0,  wl=-4.0,
             l1=(0.0, 0.5), l2=(0.0, -0.5)),
    ]
    out = []
    for i in range(frame_count):
        k = keys[min(i, len(keys) - 1)]
        out.append(rig.pose(
            Xf(P["body"]["pivot"], angle=k["bang"], sx=k["sx"], sy=k["sy"], dy=k["dy"]),
            Xf(P["head"]["pivot"], angle=k["hang"], dy=k["dy"] * 0.22),
            Xf(P["crest"]["pivot"], angle=k["cang"], dy=k["dy"] * 0.14),
            Xf(P["wing_r"]["pivot"], angle=k["wr"], dy=-k["wr"] * 0.18),
            Xf(P["wing_l"]["pivot"], angle=k["wl"], dy=-k["wl"] * 0.18),
            Xf(P["leg_l"]["pivot"], angle=k["l1"][1], dy=k["l1"][0]),
            Xf(P["leg_r"]["pivot"], angle=k["l2"][1], dy=k["l2"][0]),
        ))
    return out


def hit(frame_count):
    """RUN -> impact -> knockback -> tumble -> defeated rest (held on last frame).

    The body tumbles about the canvas centre and drifts right so the fallen
    pose lands fully inside the frame instead of being clipped.
    """
    n_run = 2
    # ang, sx, sy, dx, dy, head, crest, wingR, wingL, legL(ang,dy), legR(ang,dy)
    # The body pivots on the silhouette centre so the tumble stays framed; the
    # part angles stay small because the body rotation already carries the motion
    # and large relative angles make MLS inflate the sprite.
    fall = [
        (-13.0, 1.06, 0.945, 0.0, 0.0, -9.0, -12.0, -18.0, 18.0, (-16.0, 0.0), (16.0, 0.0)),
        (-29.0, 1.05, 0.965, -4.0, -6.0, -12.0, -16.0, -22.0, 20.0, (-22.0, -6.0), (20.0, -4.0)),
        (-46.0, 1.04, 0.985, -8.0, -4.0, -10.0, -14.0, -24.0, 22.0, (-16.0, -3.0), (14.0, -2.0)),
        (-62.0, 1.03, 0.995, -12.0, 4.0, -6.0, -8.0, -22.0, 20.0, (-8.0, 0.0), (8.0, 0.0)),
        (-76.0, 1.02, 1.005, -16.0, 18.0, -2.0, -3.0, -20.0, 18.0, (-3.0, 0.0), (3.0, 0.0)),
        (-86.0, 1.01, 1.010, -20.0, 38.0, 2.0, 3.0, -18.0, 16.0, (2.0, 0.0), (-2.0, 0.0)),
        (-92.0, 1.01, 1.010, -24.0, 58.0, 5.0, 6.0, -16.0, 14.0, (5.0, 0.0), (-4.0, 0.0)),
        (-95.0, 1.01, 1.005, -26.0, 76.0, 7.0, 8.0, -14.0, 12.0, (7.0, 0.0), (-6.0, 0.0)),
        (-96.5, 1.02, 0.995, -28.0, 84.0, 8.0, 9.0, -12.0, 10.0, (8.0, 0.0), (-7.0, 0.0)),
        (-97.0, 1.025, 0.975, -29.0, 80.0, 8.0, 8.0, -12.0, 10.0, (7.0, 0.0), (-6.0, 0.0)),
        (-98.5, 1.01, 1.0, -30.0, 84.0, 8.0, 8.0, -12.0, 10.0, (7.0, 0.0), (-6.0, 0.0)),
        (-99.5, 1.0, 1.0, -30.0, 86.0, 8.0, 8.0, -12.0, 10.0, (7.0, 0.0), (-6.0, 0.0)),
        (-100.0, 1.0, 1.0, -30.0, 86.5, 8.0, 8.0, -12.0, 10.0, (7.0, 0.0), (-6.0, 0.0)),
        (-100.0, 1.0, 1.0, -30.0, 86.0, 8.0, 8.0, -12.0, 10.0, (7.0, 0.0), (-6.0, 0.0)),
    ]
    body_pivot = rig.CENTER_N
    out = [_run_pose(i / (n_run * 2.0)) for i in range(n_run)]
    for k in fall[: max(0, frame_count - n_run)]:
        out.append(rig.pose(
            Xf(body_pivot, angle=k[0], sx=k[1], sy=k[2], dx=k[3], dy=k[4]),
            Xf(P["head"]["pivot"], angle=k[5]),
            Xf(P["crest"]["pivot"], angle=k[6]),
            Xf(P["wing_r"]["pivot"], angle=k[7]),
            Xf(P["wing_l"]["pivot"], angle=k[8]),
            Xf(P["leg_l"]["pivot"], angle=k[9][0], dy=k[9][1]),
            Xf(P["leg_r"]["pivot"], angle=k[10][0], dy=k[10][1]),
        ))
    return out[:frame_count]


def win(frame_count):
    """STOP -> small jump -> celebrate. Frames 0-1 settle from the run, then
    2..N loop as a pure celebration cycle (see MASCOT_ANIMATIONS.loopFrom)."""
    keys = [
        dict(bang=9.0,  sx=1.020, sy=0.945, dy=2.0,  hang=4.0,  cang=3.0,  wr=14.0, wl=-14.0),
        dict(bang=2.5,  sx=1.010, sy=0.980, dy=-1.0, hang=1.0,  cang=1.0,  wr=4.0,  wl=-4.0),
        dict(bang=-1.0, sx=0.985, sy=0.920, dy=6.0,  hang=1.5,  cang=2.0,  wr=10.0, wl=-10.0),
        dict(bang=-5.0, sx=0.960, sy=1.055, dy=-20.0, hang=-2.0, cang=-4.0, wr=-22.0, wl=22.0),
        dict(bang=-7.0, sx=0.985, sy=1.015, dy=-33.0, hang=-4.0, cang=-7.0, wr=-30.0, wl=30.0),
        dict(bang=-4.0, sx=1.005, sy=1.000, dy=-18.0, hang=-2.5, cang=-4.0, wr=-20.0, wl=20.0),
        dict(bang=0.0,  sx=1.065, sy=0.900, dy=4.0,  hang=1.0,  cang=2.0,  wr=16.0, wl=-16.0),
        dict(bang=-4.0, sx=0.975, sy=1.040, dy=-14.0, hang=-2.0, cang=-3.0, wr=-18.0, wl=18.0),
        dict(bang=-6.0, sx=0.985, sy=1.010, dy=-22.0, hang=-3.5, cang=-6.0, wr=-28.0, wl=28.0),
        dict(bang=-2.0, sx=1.030, sy=0.955, dy=0.0,  hang=0.5,  cang=1.0,  wr=20.0, wl=-20.0),
        dict(bang=-3.0, sx=1.000, sy=1.005, dy=-7.0,  hang=-1.5, cang=-2.0, wr=24.0, wl=-24.0),
    ]
    out = []
    for i in range(frame_count):
        k = keys[min(i, len(keys) - 1)]
        out.append(rig.pose(
            Xf(P["body"]["pivot"], angle=k["bang"], sx=k["sx"], sy=k["sy"], dy=k["dy"]),
            Xf(P["head"]["pivot"], angle=k["hang"], dy=k["dy"] * 0.18),
            Xf(P["crest"]["pivot"], angle=k["cang"], dy=k["dy"] * 0.12),
            Xf(P["wing_r"]["pivot"], angle=k["wr"], dy=-k["wr"] * 0.22),
            Xf(P["wing_l"]["pivot"], angle=k["wl"], dy=-k["wl"] * 0.22),
        ))
    return out


ANIMATIONS = {
    "idle": (8, idle),
    "run": (12, run),
    "step": (7, step),
    "hit": (14, hit),
    "win": (10, win),
}

# Shipped frame metadata. `loopFrom` marks where the seamless cycle starts, so
# the runtime can play a one-shot lead-in and then loop only the cycle part.
# A `loop: false` state plays once and holds its final frame.
FRAME_MANIFEST = {
    "cell": RUNTIME_CELL,
    "master": MASTER,
    "anchor": {"x": rig.ANCHOR_X, "y": rig.ANCHOR_Y},
    "states": {
        "idle": {"frames": 8, "fps": 12, "loop": True, "loopFrom": 0},
        "run": {"frames": 12, "fps": 14, "loop": True, "loopFrom": 0},
        "step": {"frames": 7, "fps": 12, "loop": False, "loopFrom": 7},
        "hit": {"frames": 14, "fps": 12, "loop": False, "loopFrom": 14},
        "win": {"frames": 10, "fps": 12, "loop": True, "loopFrom": 2},
    },
}


# ==========================================================================
# Vehicles
# ==========================================================================
VEH_W, VEH_H = 512, 512


def _shade(img, box, colour, radius=0):
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(box, radius=radius, fill=colour)


def _wheel(img, cx, cy, r):
    d = ImageDraw.Draw(img)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(26, 30, 38, 255))
    d.ellipse([cx - r * 0.52, cy - r * 0.52, cx + r * 0.52, cy + r * 0.52],
              fill=(126, 138, 152, 255))
    d.ellipse([cx - r * 0.20, cy - r * 0.20, cx + r * 0.20, cy + r * 0.20],
              fill=(58, 66, 78, 255))


def _car(base, glass, outline=(14, 18, 24, 255)):
    img = Image.new("RGBA", (VEH_W, VEH_H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # body (facing left)
    d.rounded_rectangle([70, 236, 442, 366], radius=34, fill=base)
    # cabin
    d.rounded_rectangle([128, 158, 356, 268], radius=30, fill=base)
    d.rounded_rectangle([150, 178, 214, 254], radius=16, fill=glass)
    d.rounded_rectangle([232, 178, 330, 254], radius=16, fill=glass)
    # hood + lights
    d.rounded_rectangle([64, 250, 130, 292], radius=16, fill=base)
    d.rounded_rectangle([60, 254, 96, 290], radius=12, fill=(255, 226, 138, 255))
    d.rounded_rectangle([406, 254, 442, 288], radius=12, fill=(255, 92, 92, 255))
    # lower trim
    d.rounded_rectangle([84, 340, 428, 368], radius=14, fill=(28, 34, 44, 255))
    _wheel(img, 150, 366, 42)
    _wheel(img, 372, 366, 42)
    # outline
    edge = img.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.MaxFilter(5))
    edge = edge.filter(ImageFilter.GaussianBlur(0.6))
    tint = Image.new("RGBA", img.size, outline)
    tint.putalpha(edge.getchannel("A").point(lambda v: 190 if v > 40 else 0))
    img = Image.alpha_composite(tint, img)
    return img


def _truck(body, glass):
    img = Image.new("RGBA", (VEH_W, VEH_H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([46, 176, 268, 352], radius=26, fill=body)      # cab
    d.rounded_rectangle([268, 150, 470, 352], radius=22, fill=body)     # box body
    d.rounded_rectangle([66, 196, 176, 258], radius=18, fill=glass)
    d.rounded_rectangle([292, 178, 446, 300], radius=14, fill=(46, 56, 72, 255))
    d.rounded_rectangle([300, 186, 438, 226], radius=10, fill=(70, 84, 104, 255))
    d.rounded_rectangle([40, 196, 78, 236], radius=12, fill=(255, 226, 138, 255))
    d.rounded_rectangle([42, 330, 466, 356], radius=12, fill=(28, 34, 44, 255))
    _wheel(img, 118, 352, 40)
    _wheel(img, 386, 352, 40)
    edge = img.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.MaxFilter(5))
    edge = edge.filter(ImageFilter.GaussianBlur(0.6))
    tint = Image.new("RGBA", img.size, (14, 18, 24, 255))
    tint.putalpha(edge.getchannel("A").point(lambda v: 190 if v > 40 else 0))
    return Image.alpha_composite(tint, img)


def _taxi(body, glass):
    img = _car(body, glass)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([196, 116, 300, 168], radius=10, fill=(250, 202, 40, 255))
    d.rounded_rectangle([214, 130, 282, 156], radius=6, fill=(70, 58, 12, 255))
    d.rectangle([190, 164, 306, 172], fill=(28, 34, 44, 255))
    d.rounded_rectangle([150, 250, 186, 300], radius=8, fill=(28, 34, 44, 255))
    d.rounded_rectangle([160, 262, 176, 288], radius=6, fill=(250, 202, 40, 255))
    return img


VEHICLES = [
    ("vehicle-01", lambda: _car((214, 62, 62, 255), (150, 206, 240, 255))),
    ("vehicle-02", lambda: _truck((58, 106, 178, 255), (154, 212, 244, 255))),
    ("vehicle-03", lambda: _taxi((238, 172, 32, 255), (150, 206, 240, 255))),
]


# ==========================================================================
# Output
# ==========================================================================
def sprite_sheet(frames, cell=RUNTIME_CELL):
    sheet = Image.new("RGBA", (cell * len(frames), cell), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.alpha_composite(f.resize((cell, cell), Image.LANCZOS), (i * cell, 0))
    return sheet


def game_tile(frames, path):
    tile = Image.new("RGBA", (512, 396), (12, 18, 26, 255))
    d = ImageDraw.Draw(tile)
    for y in range(396):                                   # road + gradient sky
        t = y / 396.0
        d.line([(0, y), (512, y)],
               fill=(int(12 + 30 * (1 - t)), int(18 + 34 * (1 - t)), int(28 + 44 * (1 - t)), 255))
    d.rectangle([0, 120, 512, 396], fill=(24, 30, 40, 255))
    for x in range(0, 512, 64):
        d.rectangle([x, 250, x + 34, 258], fill=(214, 186, 96, 255))
    veh = Image.open(os.path.join(ASSET_VEH, "vehicle-02.png")).convert("RGBA")
    tile.alpha_composite(veh.resize((210, 210), Image.LANCZOS), (26, 118))
    hero = frames[3] if len(frames) > 3 else frames[0]
    tile.alpha_composite(hero.resize((248, 248), Image.LANCZOS), (228, 108))
    tile.filter(ImageFilter.SMOOTH).save(path, "WEBP", quality=86, method=6)
    tile.save(os.path.splitext(path)[0] + ".png")


def main():
    for d in (ASSET_ANIM, ASSET_VEH, PUBLIC_ANIM, PUBLIC_VEH):
        os.makedirs(d, exist_ok=True)

    print("building stage from assets/droad/mascot.png ...")
    stage = build_stage()
    a = np.array(stage)[:, :, 3]
    ys, xs = np.where(a > 8)
    print("  stage char bbox x[%d,%d] y[%d,%d]  (canvas %d, anchor y=%d)"
          % (xs.min(), xs.max(), ys.min(), ys.max(), MASTER, rig.GROUND_Y))

    for name, builder in VEHICLES:
        img = builder()
        img.save(os.path.join(ASSET_VEH, "%s.png" % name))
        img.save(os.path.join(PUBLIC_VEH, "%s.webp" % name), "WEBP", quality=90, method=6)
    print("  vehicles: %d" % len(VEHICLES))

    for state, (count, fn) in ANIMATIONS.items():
        out_dir = os.path.join(ASSET_ANIM, "mascot-%s" % state)
        os.makedirs(out_dir, exist_ok=True)
        paths = [os.path.join(out_dir, "frame-%02d.png" % (i + 1))
                 for i in range(count)]
        if SHEETS_ONLY:
            missing = [p for p in paths if not os.path.exists(p)]
            if missing:
                raise SystemExit(
                    "--sheets needs the authored frames; missing %s"
                    % os.path.basename(missing[0]))
            frames = [Image.open(p).convert("RGBA") for p in paths]
        else:
            for old in os.listdir(out_dir):
                if old.endswith(".png"):
                    os.remove(os.path.join(out_dir, old))
            poses = fn(count)
            assert len(poses) == count, (state, len(poses), count)
            frames = []
            for i, p in enumerate(poses):
                label = "mascot-%s frame-%02d" % (state, i + 1)
                _check_pose(p, label)
                img = warp(stage, p, label)
                img.save(paths[i])
                frames.append(img)
        sheet = sprite_sheet(frames)
        sheet.save(os.path.join(PUBLIC_ANIM, "mascot-%s.webp" % state),
                   "WEBP", quality=SHEET_QUALITY, method=6)
        kb = os.path.getsize(os.path.join(PUBLIC_ANIM, "mascot-%s.webp" % state)) / 1024
        print("  %-5s %2d frames  sheet %dx%d  %.0f KB" %
              (state, count, sheet.width, sheet.height, kb))
        if state == "run":
            game_tile(frames, os.path.join(ROOT, "public", "games", "dlicomroad.webp"))

    with open(os.path.join(PUBLIC_ANIM, "manifest.json"), "w") as fh:
        json.dump(FRAME_MANIFEST, fh, indent=2)
        fh.write("\n")
    print("  manifest -> public/droad/animations/manifest.json")
    print("done.")


if __name__ == "__main__":
    main()
