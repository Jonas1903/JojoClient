---
name: frontend-design
description: Mandatory procedure for any visual / UI design change in this repo. Enforces the JojoClient design system (tool UI, not marketing UI) and removes the visual tells that mark a UI as AI-generated. USE WHENEVER editing App.tsx markup, App.css, index.css, index.html, jojoclient.html, adding/changing colors, spacing, radii, shadows, animations, icons, or any new visual component.
disable-model-invocation: false
context: inherit
argument-hint: "[design task]"
---

# Frontend Design Skill — JojoClient

You are about to touch UI. **Stop. Read this entire file before writing any CSS, JSX markup, or style attribute.** The goal of every design edit in this repo is the same: produce a UI that looks like it was crafted by a careful human engineer (VS Code, Linear, Zed, Warp) and **never** like an AI-generated "modern dark UI" template.

The visual rules live in `CLAUDE.md` under the "UI Design System" section. This skill is the *procedure* that forces those rules to be applied. Do not invent design tokens or freestyle styling — this codebase already has a fully-defined system in `:root` inside [src/App.css](src/App.css).

---

## Step 0 — Establish Context (always)

Before any edit:

1. Open [src/App.css](src/App.css) and read the `:root` token block. Note exactly which `--bg-*`, `--text-*`, `--border-*`, `--accent*`, `--radius-*`, `--shadow-*`, `--transition-*` tokens already exist.
2. Open [src/App.tsx](src/App.tsx) and search for the **closest existing component** to what you are about to build (a similar card, modal, list row, button, badge). Match its structure, class naming, and token usage.
3. Re-read the "UI Design System" section in [CLAUDE.md](CLAUDE.md). Treat every rule there as a hard constraint, not a suggestion.

If your edit would require introducing a value that does not map to an existing token, **stop and tell the user** before adding a new token. New tokens are a design decision, not an implementation detail.

---

## Step 1 — The Anti-AI Hard Rules (zero tolerance)

These are the visual tells that immediately mark a UI as AI-generated. None of them appear anywhere in this codebase, and none may be introduced. Before you write a style, scan it against this list:

| Forbidden pattern | Why it's an AI tell | Correct approach |
|---|---|---|
| `linear-gradient(...)` on backgrounds, buttons, text | Marketing/Dribbble aesthetic; this is a tool, not a landing page. | Flat fill via `var(--bg-*)` or `var(--accent)`. |
| Colored `box-shadow` (any non-black rgba glow, e.g. `0 0 20px rgba(34,197,94,.4)`) | "Neon glow" is the #1 AI UI tell. | Use the `--shadow-sm/md/lg` tokens (black only). Shadow = depth, never attention. |
| `transform: translateY(-Npx)` or `scale(1.0N)` on hover | "Lift on hover" is showy and unanchored. | Hover changes `background-color`, `color`, or `border-color` only. |
| Bounce / spring / elastic easing (cubic-bezier outside 0–1, or `cubic-bezier(0.68,-0.55,...)`) | Bouncy motion = playful = wrong tone. | Use `--transition-fast/normal/slow` (all `cubic-bezier(0.4,0,0.2,1)`). |
| Pulsing / breathing / shimmer animations on stable states | "Active = glowing dot" is AI default. | Static color change communicates state. See state table below. |
| `border-radius` ≥ 12px on non-circular elements (16, 20, 24, 9999px on rectangles) | Bubbly / mobile-mockup feel. | Use `--radius-xs/sm/md/lg/xl`. `--radius-full` only for true pills, toggle tracks, progress bars, scrollbar thumbs. |
| A second accent color (blue, purple, teal, pink "for variety") | Five accents = AI generated. | **One accent. Green. That is it.** Semantic colors (`--warning`, `--danger`, `--info`) are for state only — never decoration. |
| Emoji as icons (🎮 ⚙️ 🔧 🗑️ ▶️ ✨) | Instant "unfinished prototype" signal. | Inline SVG only, defined at the top of `App.tsx`, `strokeWidth="1.4"`, Lucide-style. |
| Mixing filled and stroke icons | Visual incoherence. | Stroke icons throughout. `currentColor` only. |
| `letter-spacing` ≥ 0.05em on non-uppercase text | Wide tracking on sentence-case = AI "elegant" trope. | Wide tracking is only for uppercase 11–12px labels. |
| `font-weight: 300` (or `200`, `100`) | Thin fonts on dark = looks fragile and generic. | Weights 400 / 500 / 600 / 700 only. |
| `2px` decorative borders | Heavy borders = childish. | All borders are `1px`. The inset 2px selection bar is `box-shadow: inset`, not a border. |
| Multi-accent gradient text (`background-clip: text` with gradient) | Pure marketing copy. | Solid `var(--text-primary)` or `var(--accent)`. |
| Glass / heavy `backdrop-filter: blur(20px+)` on cards | "Glassmorphism" = 2021 AI trope. | Solid flat surfaces. Blur is allowed *only* on the modal overlay at `blur(8px)`. |
| Centered "hero" with oversized headings (40px+, 64px+) | Landing-page aesthetic. | Largest heading in app is 28px. |
| Confetti, particles, sparkles, staggered list entrance animations | Celebration UI for a launcher = wrong. | No entrance animations on lists. Only allowed motion: spinner, indeterminate progress, modal fade/slide. |
| Inline literal colors in JSX (`style={{ color: '#22C55E' }}`) or in CSS (`background: #18181B`) | Bypasses the token system; breaks light theme. | Always `var(--token-name)`. If you need the value, the token already exists. |
| New surface level beyond the six `--bg-*` tokens | Seventh background = visual noise. | Pick the closest existing layer. |
| Hover **lightens** the accent (e.g. `--accent` → lighter green) | Looks "magical". | Hover always **darkens** (`--accent-hover`). |
| Decorative dividers (`<hr>`, `border-top: 2px solid`) between every section | Over-segmented = generated. | Use spacing for separation. Use `--border-subtle` `1px` only when truly needed. |
| Centered emoji-or-icon "empty state" with a friendly sentence and a CTA pill button | Stock template empty state. | Quiet text in `--text-muted`, single secondary button if action needed. |

If any of these are present in code you are about to write, **delete them before saving the file.**

---

## Step 2 — Token Discipline

All visual values come from `:root` in [src/App.css](src/App.css). The rule is binary:

- ✅ `background: var(--bg-card);`
- ❌ `background: #1C1C1F;`

This is non-negotiable because the light theme and any future theme rely on token indirection. A literal color is a bug.

**Quick reference — six background layers (deepest → shallowest):**
`--bg-base` → `--bg-surface` → `--bg-elevated` → `--bg-card` → `--bg-card-hover` (hover only) → `--bg-input` (depth-inverted, for fields).

**Text — four levels only:** `--text-primary` (sparingly, for active/heading), `--text-secondary` (body), `--text-muted` (captions, placeholders, section labels), `--text-disabled` (disabled controls).

**Accent — exactly one:** `--accent` (green). Hover = `--accent-hover` (darker). Selected fills use `--accent-muted` (8% green wash).

**Radii:** `xs 3` / `sm 4` / `md 6` (default) / `lg 8` / `xl 10` / `full`. Anything else is wrong.

**Spacing:** multiples of 4 only. Common: 4, 8, 10, 12, 14, 16, 20, 24, 28, 32. Never 18, 22, 26.

---

## Step 3 — State Communication Without Animation

State is communicated by **static color and text changes**, not motion. Use this table verbatim:

| State | Implementation |
|---|---|
| Hover (interactive) | `background` / `color` / `border-color` change via `--transition-fast`. No transform. No shadow change. |
| Focus (input/button) | Border color → `--border-focus`. Nothing else. No glow ring. |
| Selected (list row) | `box-shadow: inset 2px 0 0 var(--accent)` + `background: var(--bg-elevated)` + chip recolor to `--accent-muted` / `--accent`. |
| Active tab | Text → `--text-primary`, `font-weight: 600`, `::after` underline `height: 2px; background: var(--accent)` scoped to text width. No pill background. |
| Running / live | Static `1px solid var(--accent)` border + `color: var(--accent)` + `background: var(--bg-elevated)`. **No pulse.** |
| Downloading | Button background → `--bg-elevated`, label → phase text, button disabled, progress bar above. |
| Disabled | `opacity: 0.4` to `0.45`. No strikethrough, no shimmer. |
| Error | Inline banner: `var(--danger)` text on `--danger-muted` background, `1px solid var(--danger)` bottom border. Not a modal. |
| Loading (initial) | Centered CSS border-top spinner + `--text-muted` label. Not a skeleton. |

If you find yourself reaching for `@keyframes` for any state not in the allowed list (spin, progress-indeterminate, fadeIn on overlay, slideUp on modal, slideDown on top banner), stop — you are about to add an AI tell.

---

## Step 4 — Buttons (the six variants are exhaustive)

`.btn-primary` · `.btn-secondary` · `.btn-ghost` · `.btn-danger` · `.btn-icon` · dashed "add" (`.new-installation-btn`).

Sizes: `.btn-sm` 28px / default 34px / `.btn-lg` 40px. Play button is the one exception at 196×52.

If your task seems to need a "seventh" button variant, you are almost certainly recreating one of the six. Re-check before adding new classes.

`.btn-primary` uses **black text on green** (`color: #000`). This is intentional accessibility; do not change it to white.

`.btn-danger` is **low-opacity red by default**, solid red on hover. Never solid red at rest — that screams.

---

## Step 5 — Typography Discipline

- Body: `Inter`, 14px, `letter-spacing: -0.01em`, antialiased.
- Mono (`var(--font-mono)`): **only** for computer-generated identifiers — versions, RAM values, UUIDs, paths, log output. Never for UI labels.
- Sizes in use: 28 / 20 / 16 / 14 / 13 / 12 / 11 / 10. Pick from this set. Do not invent 15, 17, 19, 22.
- Weights: 400 / 500 / 600 / 700. Nothing else.
- Tight tracking (`-0.02em`) on large headings; default on body; wide tracking (`0.05–0.08em`) only on **uppercase** 11–12px labels.

---

## Step 6 — Icons

All icons are inline SVG components at the top of [src/App.tsx](src/App.tsx). When adding a new one:

- 14×14 viewBox (or 13 in tighter contexts).
- `strokeWidth="1.4"`, `strokeLinecap="round"`, `strokeLinejoin="round"`.
- `stroke="currentColor"` or `fill="currentColor"` — never a hardcoded color.
- `aria-hidden="true"`.
- Name `IconNoun` (e.g. `IconFolder`, `IconArrowLeft`).
- Lucide-style geometry. Match the visual weight of existing icons.

**Never use emoji in labels, buttons, headings, or as decorative bullets.** If you are tempted to drop a 🎮 in for "flavor", that is the AI talking.

---

## Step 7 — Modals & Overlays

- Overlay: `rgba(0,0,0,0.75)` + `backdrop-filter: blur(8px)` + `fadeIn 0.2s`.
- Modal card: `slideUp 0.25s` with `translateY(20px) scale(0.98) → 0/1`. Do not amplify this entrance.
- Width: standard 440px, install form 500px, confirm 380px. **Never exceed 600px.**
- Padding: `28px`.
- Header: 20px, weight 600, `letter-spacing: -0.02em`, `margin-bottom: 24px`. No divider line.
- **No floating × close button.** Dismiss via action buttons only.
- Action button order: **primary left, cancel right**.

---

## Step 8 — Pre-Commit Checklist (run mentally before saving)

Walk through every item. If any is true, fix before you stop.

- [ ] Did I use only existing tokens? (No literal `#hex` or `rgb()` in CSS/JSX.)
- [ ] Are all radii ≤ 10px (or `--radius-full` only on pills/tracks/progress/scrollbars)?
- [ ] Are all borders 1px?
- [ ] Is every shadow black (depth) — no colored glows?
- [ ] Zero `transform` on hover (except modal entrance)?
- [ ] Zero `linear-gradient` anywhere?
- [ ] Zero emoji in markup?
- [ ] One accent color only? (Green. `--danger`/`--warning`/`--info` are state, not decoration.)
- [ ] All icons stroke-style, `strokeWidth="1.4"`, `currentColor`?
- [ ] No new `@keyframes` outside the allowed five (spin, progress-indeterminate, fadeIn, slideUp, slideDown)?
- [ ] No `letter-spacing` ≥ 0.05em on sentence-case text?
- [ ] No font weights outside {400, 500, 600, 700}?
- [ ] No font sizes outside {10, 11, 12, 13, 14, 16, 20, 28}?
- [ ] No spacing values that aren't multiples of 4?
- [ ] If theming, did I avoid hardcoded colors so light theme adapts automatically?
- [ ] Does the result feel like VS Code / Linear / Zed — or like a Dribbble shot? If the latter, strip it down.

---

## Step 9 — Verify

After the edit, run:

```
npx tsc -p tsconfig.json --noEmit
```

Then visually re-scan the affected component against Step 1's table. If anything on that table is present, remove it.

---

## Working Style for Design Edits

- **Restraint wins.** When in doubt, do less. A flat plain button beats an animated one. A static color change beats a pulse.
- **Match what's already there.** Find the nearest existing component and mirror its structure. Consistency is the entire point.
- **Push back if the user requests an AI tell.** If the user asks for "a subtle glow on the play button", "a gradient header", "a pulsing dot when running", or similar — point out (briefly, once) that it violates the system and ask whether they want a conscious override. A conscious override is fine. Silently implementing it is not. (See "Act Like a Colleague" in CLAUDE.md.)
- **Never add a comment explaining a style choice.** The token name is the explanation. If a value is non-obvious, it should be a named token, not a commented literal.

If you finish a design edit and the result could plausibly appear on a "10 modern dark dashboard concepts" article, you have failed this skill. Start over with less.
