"""
Dlicom Road - mascot deformation rig.

The rig never redraws or restyles the mascot. Every output frame is produced by
warping the *original* RGBA pixels of `assets/droad/mascot.png`, so body shape,
face, colours, proportions, head, cape/wings and emblem are preserved exactly.

Deformation model: rigid moving-least-squares
---------------------------------------------
The character is described by a set of control points, each owned by one rig
part (body, head, crest, wing_r, wing_l, leg_l, leg_r). A pose states what each
part does; the pose is then flattened into "where does each control point end up"
by composing every part transform along its parent chain.

The displacement field is a rigid moving-least-squares (MLS) warp
(Schaefer, Howerstone & McCrane 2006): a local rigid transform is fitted around
each control point and the field is their Gaussian-weighted average.

    D(p) = SUM_i w_i(p) [ R_i p + t_i - p ] / SUM_i w_i(p)

Rigid moving-least-squares is used rather than an additive per-part weight blend
because the latter folds (negative Jacobian) as soon as a part rotates far from
its neighbours, which tears the sprite and makes the mesh inversion solver
diverge. With rigid local transforms a globally rigid pose reproduces the exact
rigid motion, so the field stays injective and the mascot is never inverted,
pinched or resized. ``min_jacobian()`` asserts this for every generated frame.

Landmarks below were measured from the alpha silhouette of mascot.png
(character bbox x[97,1040] y[34,1227] inside a 1254x1254 source canvas).
"""

import numpy as np

# --------------------------------------------------------------------------
# Canvas / placement
# --------------------------------------------------------------------------
# All frames share one 1280x1280 canvas so the runtime can treat every frame as
# the same sprite and only animate the anchor. The mascot is pre-composed into
# that canvas once, so the rig below works in final output space.
#
# The canvas is deliberately wider and taller than the standing character: the
# defeat animation tumbles the mascot onto its side, and a lying 800px mascot
# is ~800px across, so anything near 1024 would clip the sprite mid-tumble.
CANVAS = 1280

SRC_SIZE = 1254
SRC_BBOX = (97, 34, 1040, 1227)  # alpha bbox of the mascot in mascot.png

# Character height target and ground line, chosen so the character leaves
# headroom for jumps/knockback and footroom for the road shadow.
CHAR_HEIGHT = 800
GROUND_Y = 940
CHAR_TOP = GROUND_Y - CHAR_HEIGHT

_scale = CHAR_HEIGHT / float(SRC_BBOX[3] - SRC_BBOX[1])  # 800 / 1193
_char_w = (SRC_BBOX[2] - SRC_BBOX[0]) * _scale
X_OFFSET = (CANVAS - _char_w) / 2.0  # centre the character horizontally

# Centre of the standing silhouette. The defeat tumble pivots here so the
# mascot rotates in place instead of swinging out of frame.
CHAR_CENTER = (X_OFFSET + _char_w / 2.0, (CHAR_TOP + GROUND_Y) / 2.0)

# Anchor expressed in normalised canvas units - the runtime positions the
# mascot by this point (centre-bottom of the sprite).
ANCHOR_X = 0.5
ANCHOR_Y = GROUND_Y / CANVAS
CENTER_N = (CHAR_CENTER[0] / CANVAS, CHAR_CENTER[1] / CANVAS)


def src_to_canvas(x, y):
    return (
        (np.asarray(x) - SRC_BBOX[0]) * _scale + X_OFFSET,
        (np.asarray(y) - SRC_BBOX[3]) * _scale + GROUND_Y,
    )


def _n(px, py):
    """Source-image pixel -> normalised canvas coords."""
    cx, cy = src_to_canvas(np.float64(px), np.float64(py))
    return float(cx / CANVAS), float(cy / CANVAS)


# --------------------------------------------------------------------------
# Measured landmarks (normalised canvas space)
# --------------------------------------------------------------------------
_L = {
    "crest_top": _n(659, 34),
    "crest_l": _n(560, 120),
    "crest_r": _n(760, 150),
    "head_c": _n(653, 320),
    "head_l": _n(520, 330),
    "head_r": _n(790, 350),
    "neck": _n(650, 520),
    "shoulder_c": _n(650, 560),
    "shoulder_l": _n(490, 600),
    "shoulder_r": _n(830, 590),
    "body_c": _n(620, 640),
    "torso_lo": _n(600, 800),
    "hip": _n(600, 890),
    "hip_l": _n(430, 900),
    "hip_r": _n(770, 910),
    "wing_r": _n(1000, 600),   # right side appendage (raised)
    "wing_r_out": _n(1030, 430),
    "wing_r_mid": _n(880, 720),
    "wing_l": _n(300, 690),    # left side appendage (swept down/out)
    "wing_l_out": _n(280, 830),
    "wing_l_mid": _n(400, 560),
    "leg_l": _n(470, 990),
    "leg_l_mid": _n(440, 1060),
    "foot_l": _n(390, 1075),
    "leg_r": _n(760, 1010),
    "leg_r_mid": _n(790, 1090),
    "foot_r": _n(830, 1220),
}

# --------------------------------------------------------------------------
# Part definitions
# --------------------------------------------------------------------------
# Each part owns a pivot and the control points that follow it. `weight` is gone:
# MLS derives the falloff from the control-point layout instead of hand-tuned
# mask shapes, so a part can be re-weighted simply by adding or moving points.
PARTS = {
    "body": dict(parent=None, pivot=_L["hip"]),
    "head": dict(parent="body", pivot=_L["neck"]),
    "crest": dict(parent="head", pivot=(0.560, 0.205)),
    "wing_r": dict(parent="body", pivot=(0.660, 0.455)),
    "wing_l": dict(parent="body", pivot=(0.455, 0.440)),
    "leg_l": dict(parent="body", pivot=_L["hip"]),
    "leg_r": dict(parent="body", pivot=_L["hip"]),
}

PART_ORDER = ["body", "head", "crest", "wing_r", "wing_l", "leg_l", "leg_r"]

# Control points per part. A part's pivot is always one of its control points, so
# rotating the part leaves the pivot itself fixed and the limb swings around it.
CONTROL_POINTS = {
    "body": ["hip", "hip_l", "hip_r", "torso_lo", "body_c", "shoulder_l",
             "shoulder_r"],
    "head": ["neck", "head_l", "head_r", "head_c"],
    "crest": ["crest_top", "crest_l", "crest_r"],
    "wing_r": ["wing_r", "wing_r_out", "wing_r_mid"],
    "wing_l": ["wing_l", "wing_l_out", "wing_l_mid"],
    "leg_l": ["leg_l", "leg_l_mid", "foot_l"],
    "leg_r": ["leg_r", "leg_r_mid", "foot_r"],
}

# Gaussian falloff radius for the MLS field, in normalised canvas units.
# Sized between the closest control-point spacing and the character's extent so
# parts stay articulated without the field pinching at the seams.
SIGMA = 0.15
# Neighbour weighting radius used when fitting each local rigid transform.
LOCAL_SIGMA = 0.22

_CP = np.array([_L[n] for part in PART_ORDER for n in CONTROL_POINTS[part]],
               dtype=np.float64)
_CP_PART = [part for part in PART_ORDER for n in CONTROL_POINTS[part]]


# --------------------------------------------------------------------------
# Affine helpers
# --------------------------------------------------------------------------
class Xf:
    """Local part transform: scale about pivot, rotate, then offset.

    ``dx`` / ``dy`` are authored in *master canvas pixels* and converted to
    normalised units here, so animation code can stay in readable px values.
    """

    __slots__ = ("px", "py", "c", "s", "sx", "sy", "dx", "dy", "_angle")

    def __init__(self, pivot, angle=0.0, sx=1.0, sy=1.0, dx=0.0, dy=0.0):
        self.px, self.py = pivot
        a = np.radians(angle)
        self.c, self.s = np.cos(a), np.sin(a)
        self._angle = float(angle)
        self.sx, self.sy = float(sx), float(sy)
        self.dx, self.dy = dx / CANVAS, dy / CANVAS

    @property
    def identity(self):
        return (abs(self._angle) < 1e-9 and abs(self.sx - 1.0) < 1e-9
                and abs(self.sy - 1.0) < 1e-9 and self.dx == 0.0
                and self.dy == 0.0)

    @property
    def angle(self):
        return self._angle

    def apply(self, x, y):
        qx = (x - self.px) * self.sx
        qy = (y - self.py) * self.sy
        return (
            self.px + qx * self.c - qy * self.s + self.dx,
            self.py + qx * self.s + qy * self.c + self.dy,
        )

    def invert(self, x, y):
        """Inverse of :meth:`apply` - used to seed the mesh solver, so a pose
        with a large overall rotation starts near the answer instead of at the
        identity and needing hundreds of Newton steps to get there."""
        qx = (x - self.px - self.dx) * self.c + (y - self.py - self.dy) * self.s
        qy = -(x - self.px - self.dx) * self.s + (y - self.py - self.dy) * self.c
        return self.px + qx / self.sx, self.py + qy / self.sy


def pose(body=None, head=None, crest=None, wing_r=None, wing_l=None,
         leg_l=None, leg_r=None):
    """Build a full rig pose. Each value is an Xf or None (= rest pose)."""
    return {
        "body": body or Xf(PARTS["body"]["pivot"]),
        "head": head or Xf(PARTS["head"]["pivot"]),
        "crest": crest or Xf(PARTS["crest"]["pivot"]),
        "wing_r": wing_r or Xf(PARTS["wing_r"]["pivot"]),
        "wing_l": wing_l or Xf(PARTS["wing_l"]["pivot"]),
        "leg_l": leg_l or Xf(PARTS["leg_l"]["pivot"]),
        "leg_r": leg_r or Xf(PARTS["leg_r"]["pivot"]),
    }


def part_chain(name):
    """Parts that must be composed to move control point owner `name`."""
    chain = []
    while name is not None:
        chain.append(name)
        name = PARTS[name]["parent"]
    return chain[::-1]  # outermost first


_CHAINS = {part: part_chain(part) for part in PART_ORDER}


def targets(pose_d):
    """Flatten a pose into (N, 2) source and target control point arrays."""
    q = _CP.copy()
    for i, part in enumerate(_CP_PART):
        x, y = _CP[i]
        for p in _CHAINS[part]:
            xf = pose_d.get(p)
            if xf is None or xf.identity:
                continue
            x, y = xf.apply(np.float64(x), np.float64(y))
        q[i, 0] = x
        q[i, 1] = y
    return _CP, q


def _procrustes(c, q, w):
    """Best-fit 2D rotation taking c onto q.

    Minimising sum_i w_i |R c_i - q_i|^2 over rotations R gives
    theta = arg( sum_i w_i conj(c_i - c_bar) (q_i - q_bar) ), which is exact and
    - unlike the SVD form - unambiguous for a pure translation, where it returns
    the identity instead of an arbitrary reflection.
    """
    cs = (w[:, None] * c).sum(0) / w.sum()
    qs = (w[:, None] * q).sum(0) / w.sum()
    z = (w * np.conj(c[:, 0] - cs[0] + 1j * (c[:, 1] - cs[1]))
         * (q[:, 0] - qs[0] + 1j * (q[:, 1] - qs[1]))).sum()
    th = np.angle(z)
    ct, st = np.cos(th), np.sin(th)
    return np.array([[ct, -st], [st, ct]])


def _local_rigid(c, q):
    """Rigid moving-least-squares local transforms (Schaefer et al. 2006, 3.1).

    For every control point a rotation/translation is fitted through its
    neighbourhood by weighted Procrustes. The resulting field averages those
    rigid maps, which is what keeps the deformation injective.
    """
    d2 = ((c[:, None, :] - c[None, :, :]) ** 2).sum(-1)
    nb = np.exp(-d2 / (2.0 * LOCAL_SIGMA ** 2))
    np.fill_diagonal(nb, 0.0)
    R = np.empty((len(c), 2, 2))
    t = np.empty((len(c), 2))
    for i in range(len(c)):
        w = nb[i]
        ws = w.sum()
        if ws <= 1e-12:
            R[i] = np.eye(2)
            t[i] = q[i] - c[i]
            continue
        R[i] = _procrustes(c, q, w)
        t[i] = (w[:, None] * q).sum(0) / ws - R[i] @ ((w[:, None] * c).sum(0) / ws)
    return R, t


_FIELD_CACHE = {}


def _field(pose_d):
    key = id(pose_d)
    hit = _FIELD_CACHE.get(key)
    if hit is not None and hit[0] is pose_d:
        return hit[1]
    R, t = _local_rigid(*targets(pose_d))
    _FIELD_CACHE.clear()
    _FIELD_CACHE[key] = (pose_d, (R, t))
    return R, t


def displacement(pose_d, nx, ny):
    """Rigid-MLS displacement field D(nx, ny) in normalised canvas units."""
    R, t = _field(pose_d)
    nx = np.asarray(nx, dtype=np.float64)
    ny = np.asarray(ny, dtype=np.float64)
    dx = np.zeros(np.broadcast(nx, ny).shape)
    dy = np.zeros_like(dx)
    tot = np.zeros_like(dx)
    for i in range(len(_CP)):
        w = np.exp(-((nx - _CP[i, 0]) ** 2 + (ny - _CP[i, 1]) ** 2)
                    / (2.0 * SIGMA ** 2))
        tot += w
        rx = R[i, 0, 0] * nx + R[i, 0, 1] * ny + t[i, 0]
        ry = R[i, 1, 0] * nx + R[i, 1, 1] * ny + t[i, 1]
        dx += w * (rx - nx)
        dy += w * (ry - ny)
    return dx / tot, dy / tot


def min_jacobian(pose_d, nx, ny, h=5e-4):
    """Smallest forward Jacobian determinant over the sampled region.

    Positive everywhere means the field is injective, so inverting it is
    well posed and the mascot can neither fold nor tear.
    """
    nx = np.asarray(nx, dtype=np.float64)
    ny = np.asarray(ny, dtype=np.float64)
    ap, bp = displacement(pose_d, nx + h, ny)
    am, bm = displacement(pose_d, nx - h, ny)
    au, bu = displacement(pose_d, nx, ny + h)
    ad, bd = displacement(pose_d, nx, ny - h)
    j11 = 1.0 + (ap - am) / (2 * h)
    j12 = (au - ad) / (2 * h)
    j21 = (bp - bm) / (2 * h)
    j22 = 1.0 + (bu - bd) / (2 * h)
    return j11 * j22 - j12 * j21
