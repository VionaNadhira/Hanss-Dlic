# UI Reference & Design System Extraction

## 1. Reference Game Selection: Crash (`/crash`)

### Why Crash is Structurally Closest to Up/Down Prediction
1. **Round-Based State Machine**: Crash operates on distinct, server/time-synchronized round phases (`COUNTDOWN`, `FLYING`/Live, `CRASHED`/Settled), which directly maps to Up/Down 5m prediction rounds (`scheduled` presale, `live`, `settling`, `resolved`, `void`).
2. **Theater / Dual-Column Layout**: 
   - Left side: Betting controls & round information panel (`w-full lg:w-80`).
   - Right side: Dynamic visual visualization stage (`flex-1 min-h-[300px] sm:min-h-[520px]`).
   - On mobile screens, stacks vertically with visual stage on top and controls beneath.
3. **Recent Rounds History Strip**: An overflow-x horizontal strip displaying recent round multiplier outcomes in rounded pill badges with colored borders (gold for high, cyan for medium, muted for low).
4. **Bet Controls & Inset Panels**: Standard numeric input with gold currency prefix `$`, quick-multiplier pills (`½`, `2×`, `MIN`, `MAX`), and inset stats panel (`bg-[#141a22] border border-[#19212a]`).
5. **Dynamic Action Buttons**: Multi-state action buttons reflecting round phases (Waiting, In-Flight, Cash Out, Disabled).

---

## 2. Extracted Design Tokens & Tokens Guide

### Color Palette (from `tailwind.config.js` & inline theme constants)
| Token | Hex Value | Usage |
|---|---|---|
| `gamdom-bg` | `#080d13` | Deep background canvas, outer stage fill |
| `gamdom-surface` / `card` | `#10151c` | Sidebar, header, primary cards, controls background |
| `gamdom-cardHover` | `#141a22` | Card hover state, dropdowns, input backgrounds |
| `gamdom-border` | `#19212a` | Standard dividers, card outlines, subtle borders |
| `gamdom-borderLight` | `#2b3440` | Scrollbars hover, active border highlights |
| `gamdom-green` / `lime` / `blue` | `#38B9F2` | Primary brand cyan accent, win indicators, active glows |
| `gamdom-gold` | `#fbb01b` | Secondary accent, balances, hot tags, jackpot highlights |
| `gamdom-red` | `#ff4d4f` | Down/Bearish side, crash state, errors, countdown alerts |
| `gamdom-textLight` | `#FFFFFF` | Primary headings, active values, button text |
| `gamdom-text` | `#9aa7b4` | Secondary text, input labels, inactive navigation |
| `gamdom-textDim` | `#6f7d8a` | Category labels, section dividers, timestamps |

### Typography Scale & Fonts
- **Fonts**: `Inter`, fallback `system-ui, sans-serif`, and `'Gamdom', sans-serif` via `@import`.
- **Headings**:
  - `h1`: `text-xl sm:text-2xl font-bold uppercase tracking-wider text-white`
  - Category / Supertitle: `text-[10px] font-black uppercase tracking-widest text-gamdom-textDim`
- **Labels**: `text-xs font-bold uppercase text-gamdom-text` (`fontSize: 12px, fontWeight: 700`)
- **Values / Numbers**: Monospace or tabular numerals, `font-bold text-sm sm:text-base`
- **Prominent Stats**: `text-4xl sm:text-6xl font-bold tracking-tight text-white`

### Card & Panel Specifications
- **Main Theater Outer Frame**: `rounded-[20px_20px_0px_0px]` or `rounded-2xl`, `overflow-hidden`, `border border-[#19212a]`, `bg-[#080d13]`.
- **Controls Column**: `w-full lg:w-80 p-4 sm:p-6 bg-[#10151c] flex flex-col justify-between`.
- **Inset Stat Box**: `p-3.5 space-y-2 text-xs bg-[#141a22] border border-[#19212a] rounded-[4px]` or `rounded-xl`.
- **Shadows**:
  - `shadow-gamdom-card`: `0 8px 30px -4px rgba(0, 0, 0, 0.6)`
  - `shadow-gamdom-green`: `0 0 20px -3px rgba(56, 185, 242, 0.45)`
  - `shadow-gamdom-gold`: `0 0 20px -3px rgba(251, 176, 27, 0.35)`

### Button Variants & Interactive Elements
- **Primary Action Button**:
  - Background: `#ffffff` or `bg-gamdom-green`
  - Text: `#080d13` (dark text on white/cyan), `font-bold text-sm uppercase`
  - Radius: `rounded-[4px]` or `rounded-xl`
  - Disabled: `opacity-40` or `opacity-50`, cursor-not-allowed
- **Secondary / Quick Preset Chips**:
  - `bg-transparent border border-[#ffffff]/20 hover:border-[#ffffff] text-white text-xs font-bold py-1.5 rounded-[4px]`
- **Up / Down Side Buttons**:
  - Up Side: Green accent border & background (`bg-[#38B9F2]/10 border border-[#38B9F2] text-[#38B9F2] hover:bg-[#38B9F2]/20`)
  - Down Side: Red accent border & background (`bg-[#ff4d4f]/10 border border-[#ff4d4f] text-[#ff4d4f] hover:bg-[#ff4d4f]/20`)

### State & Modal Patterns
- **Logged-out State**:
  - Content remains visible in read-only mode.
  - Action buttons open `AuthGuardModal` or redirect to `/login` / `/register`.
- **Error Feedback**:
  - Inset banner: `text-xs font-bold p-2.5 rounded-[4px] text-center text-[#ff4d4f] bg-[#ff4d4f]/12 border border-[#ff4d4f]`
- **Round Transition & Result Banners**:
  - Animated banner with `aria-live="polite"` announcing settled outcome (`Up won` / `Down won`) and user payout.

---

## 3. Navigation & Registration
- Existing games are registered in:
  1. `src/components/Sidebar.tsx`: Listed under `originals` navigation array.
  2. `src/app/games/page.tsx`: Listed in the originals grid with thumbnail and badges.
  3. `src/app/page.tsx`: Listed in the homepage showcase grid.
- Up/Down will be registered under the `/play` route with market name "Up or Down" and badge "New".
