# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (runs all three concurrently: electron tsc watch, vite renderer, electron app)
npm run dev

# Individual dev processes (if you need to run separately)
npm run dev:renderer   # Vite on port 5173
npm run dev:electron   # tsc watch for electron/ and src/main/
npm run dev:app        # Launch electron (requires VITE_DEV_SERVER_URL set)

# Build distributable
npm run build          # vite build + tsc electron + electron-builder

# Type check (the repo expects both targets to pass)
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.electron.json --noEmit

# Lint
npm run lint

# Tests (Vitest, run-once)
npm run test

# Run a single test file
npx vitest run tests/profileExport.test.ts
```

## Architecture

### Two TypeScript Compilation Targets

This is a critical split to understand — there are **two separate tsconfig files**:

- **`tsconfig.json`** — Base/shared strict typecheck config. `"module": "ESNext"`, `noEmit: true`. It covers the renderer plus shared workspace code (`src/`, `electron/`, and `tests/`).
- **`tsconfig.electron.json`** — Electron emit target. It extends `tsconfig.json`, switches to `"module": "CommonJS"`, writes to `dist-electron/`, and compiles `electron/` plus `src/main/`.

Code in `src/main/` is **shared service code** — it is emitted by the Electron build, but it is also checked by the base tsconfig. Keep it Node-safe and framework-agnostic. Never import Electron APIs in `src/main/`; those belong in `electron/main.ts` and `electron/preload.ts` only.

### IPC Bridge Pattern

All communication between renderer and main process goes through a strict three-layer bridge:

1. **`electron/main.ts`** — Registers `ipcMain.handle("channel:action", ...)` handlers. All business logic lives in `src/main/services/`.
2. **`electron/preload.ts`** — Exposes `contextBridge.exposeInMainWorld("jojoclient", {...})` — this is the only way renderer code can call main process functions.
3. **`src/App.tsx`** — Calls `window.jojoclient.methodName()` — never `ipcRenderer` directly.

When adding a new feature: add handler in `main.ts` → expose in `preload.ts` → call via `window.jojoclient` in renderer. All IPC handlers return `{ ok: true, ...data }` or `{ ok: false, error: string }`.

### Data Model

**Profiles** contain a list of mods and a "template" directory of Minecraft config files. **Installations** are concrete game instances that belong to a profile. The key data flow:

- Profile `mods.json` is the source of truth for which mods a profile has.
- On every game launch, `mods.syncProfileModsToInstallation()` resolves transitive dependencies first, then downloads/copies mods from the profile into the installation's `mods/` folder.
- The mod sync cache is keyed by Minecraft version, Fabric loader version, and the full resolved slug set. A version switch should invalidate the cache if dependency resolution changes.
- Even when the sync state already matches, the launcher still re-runs lightweight validation: it scans installed JAR metadata, disables mods with missing/incompatible Fabric dependencies, and can recover from known config-parse startup crashes.
- On clean game exit (code 0), `profiles.updateTemplateSettingsFromInstallation()` copies config files back from the installation to the profile template — so settings changes in-game propagate back.
- `installationSyncChain` in `main.ts` serializes sync operations per installation via a promise chain to prevent concurrent file corruption while still allowing different installations to launch concurrently.
- `modIssues` persistence is intentional: skipped syncs should not wipe previously stored issues, but validation findings should still be written back to the installation record.

**Storage locations:**
- Launcher settings (basePath, window bounds): `app.getPath("userData")/settings.json` — managed by `src/main/utils/storage.ts`
- All game data (profiles, installations, mods): user-chosen `basePath` — managed by `src/main/utils/baseFolder.ts`
- Profile index: `{basePath}/profiles/index.json`
- Installation index: `{basePath}/profiles/{profileName}/installations/index.json`
- Profile template configs: `{basePath}/profiles/{profileName}/template/`
- Mod JARs (profile): `{basePath}/profiles/{profileName}/mods/`
- Game files (per installation): `{basePath}/profiles/{profileName}/installations/{installationName}/`

### UI Structure

`src/App.tsx` is a single large monolithic file containing the main `App` component plus the main screen and modal components. All styling is in `src/App.css` using CSS custom properties — no Tailwind, no component library.

---

## UI Design System

> **MANDATORY:** Before any frontend / visual / UI design edit — meaning any change to `src/App.tsx` markup, `src/App.css`, `src/index.css`, `index.html`, `jojoclient.html`, any inline `style={...}`, any new CSS class, color, spacing, radius, shadow, animation, icon, or visual component — you **must** read and follow [.claude/skills/frontend-design/SKILL.md](.claude/skills/frontend-design/SKILL.md). This is not optional and applies to every prompt that touches the UI, including small tweaks. The skill exists specifically to keep the UI from looking AI-generated; bypassing it is the single fastest way to regress the visual quality of this app. If a request would require violating the skill's rules, surface that to the user before implementing it.

### Core Philosophy: Tool UI, Not Marketing UI

This launcher is a **tool**, not a landing page. Every design decision should feel like something a skilled developer built with deliberate constraint — the aesthetic of VS Code, Linear, Zed, or Warp — not a Dribbble showcase or an AI-generated "modern dark UI". The distinction matters because AI-generated UIs are immediately recognizable by their visual noise: purple-to-blue gradients on buttons, colored glow box-shadows, bouncing entrance animations, bubbly 24px border radii, and five accent colors competing for attention. JojoClient uses **one accent color**. One. This is a hard rule.

The goal is a UI that feels like it was crafted by a person who cared about every 4-pixel spacing decision — not generated by something that optimized for visual impressiveness. **Restraint is the mark of quality here.** When in doubt, do less. A plain flat button beats an animated gradient button every time.

---

### Design Tokens — Use Them, Never Bypass Them

All visual values live in `:root` in `src/App.css`. Never hardcode a color, spacing, shadow, or radius that has a token. If you write `#22C55E` directly in JSX or CSS, that is a bug — use `var(--accent)`.

#### Background Layers — Zinc Family Only

Six levels from deepest to shallowest. The entire depth hierarchy of the app is expressed through these six values:

| Token | Value | Used For |
|---|---|---|
| `--bg-base` | `#09090B` | App shell, page background. The darkest layer. |
| `--bg-surface` | `#111113` | Sidebar panels, navbar. One step above base. |
| `--bg-elevated` | `#18181B` | Elevated interactive elements, hover fill states. |
| `--bg-card` | `#1C1C1F` | Cards, modals, list items. The "content" surface. |
| `--bg-card-hover` | `#232327` | Hovered card/row background. Used **only** for hover. |
| `--bg-input` | `#0D0D10` | Input fields, code areas. Darker than base — depth inversion makes fields look recessed. |

Never invent a new background value. The six-level system is intentional; a seventh level creates visual noise and breaks the hierarchy. If a new surface level is genuinely needed, raise it as a discussion.

#### Text — Four Levels, No Exceptions

| Token | Value | Used For |
|---|---|---|
| `--text-primary` | `#FAFAFA` | Headings, selected states, active labels. Used sparingly — its brightness draws the eye. |
| `--text-secondary` | `#A1A1AA` | Body text, default UI labels. |
| `--text-muted` | `#52525B` | Captions, placeholders, version metadata, section headers. |
| `--text-disabled` | `#3F3F46` | Disabled form controls only. |

Never write `color: white` or `color: #fff` directly anywhere. Always use the text tokens.

#### The One Accent

There is exactly one accent color in this design system: green.

- `--accent: #22C55E` (dark theme) / `#16A34A` (light theme)
- `--accent-hover: #16A34A` — hover always **darkens**, never lightens
- `--accent-muted: rgba(34, 197, 94, 0.08)` — semi-transparent fill behind accent-colored text, for selected states and active badges

Semantic colors (`--warning: #F59E0B`, `--danger: #EF4444`, `--info: #3B82F6`) exist for status banners, error states, and destructive button styling **only**. They are never used as an alternative accent or decoration. Never introduce a blue, purple, or teal accent on the grounds that it "looks nice". The single-accent constraint is what makes the UI feel coherent.

#### Borders — 1px Only

| Token | Used For |
|---|---|
| `--border-color: rgba(255,255,255,0.07)` | Default ring on cards and containers. |
| `--border-subtle: rgba(255,255,255,0.03)` | Hairline dividers inside components. |
| `--border-focus: rgba(34,197,94,0.40)` | Focus state on inputs — border color change, no glow. |
| `--border-hover: rgba(255,255,255,0.12)` | Border on hovered interactive elements. |

Borders are `1px`. There are no `2px` decorative strokes anywhere in this system. The inset selection bar (`box-shadow: inset 2px 0 0 var(--accent)`) appears to be 2px wide but is implemented as a box-shadow, not a border, and is a special case.

#### Shadows — Depth Only, Zero Glow

The three shadow tokens (`--shadow-sm`, `--shadow-md`, `--shadow-lg`) use `rgba(0,0,0,...)` only. No colored shadows. The rule: **shadows express depth, not attention**. Never write `box-shadow: 0 0 20px rgba(34, 197, 94, 0.5)` or any variation of a colored outer glow. A card's perceived depth comes from its background color stepping above the surface behind it, supported by a neutral black shadow. The `--shadow-card` token includes `inset 0 0 0 1px rgba(255,255,255,0.04)` — an inner ring that creates a barely-visible top-edge brightening that reads as material depth. This is intentional.

#### Border Radii — Tight and Tool-Like

| Token | Value | Used For |
|---|---|---|
| `--radius-xs` | `3px` | Tiny badges, code spans, version chips. |
| `--radius-sm` | `4px` | Small buttons, inline chips. |
| `--radius-md` | `6px` | Standard buttons, cards, default controls. The most-used value. |
| `--radius-lg` | `8px` | Inputs, selects, panels. |
| `--radius-xl` | `10px` | Modals, settings sections. |
| `--radius-full` | `9999px` | Pills, toggle tracks, progress bars, scrollbar thumbs only. |

Never use `border-radius: 16px`, `20px`, `24px`, or `50%` on anything that is not a true circle. Large radii make UIs look like mobile app mockups. If a value above `10px` feels necessary, it almost certainly is not — reconsider the component.

#### Transitions — Crisp, Not Elastic

| Token | Value | Used For |
|---|---|---|
| `--transition-fast` | `0.12s cubic-bezier(0.4,0,0.2,1)` | Hover color changes, focus border changes. |
| `--transition-normal` | `0.2s cubic-bezier(0.4,0,0.2,1)` | Card hover states, tab switching. |
| `--transition-slow` | `0.3s cubic-bezier(0.4,0,0.2,1)` | Modal entrance animations. |

Never use `ease-in-out` with durations above 300ms. Never use spring or bounce easing (cubic-bezier values outside the 0–1 range). The easing curve `cubic-bezier(0.4, 0, 0.2, 1)` is the Material Design "standard" curve — it accelerates out of rest and decelerates into the end state. It is used here because it feels mechanical and direct, not bouncy.

---

### Typography

**Body font stack:** `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`. Base size `14px`, line-height `1.5`, `-webkit-font-smoothing: antialiased`, `letter-spacing: -0.01em` on body (slightly tight, reads as "designed").

**Monospace font** (`var(--font-mono)`): `'JetBrains Mono', 'SF Mono', 'Consolas', 'Monaco', monospace`. Used **exclusively** for: Minecraft version strings (`1.21.4`), Fabric loader versions, RAM values (`8192 MB`), UUIDs, log output, file paths, any data that is a computer-generated identifier rather than human language. Never use monospace for button labels, UI text, descriptions, or headings.

**Font sizes in use:**

| Size | Used For |
|---|---|
| `28px` | Page headings (`settings h2`, setup card `h1`) |
| `20px` | Modal `h3`, account username display |
| `16px` | Brand name in navbar |
| `14px` | Primary body text, list item names |
| `13px` | Button labels, input text, secondary body |
| `12px` | Form labels (uppercase), captions |
| `11px` | Version chips, section header labels, badges |
| `10px` | Smallest badge text only |

**Font weights:** `700` for page-level headings. `600` for active tab text, modal headers, primary buttons, settings section labels. `500` for standard button labels, list item names, form input text. `400` for descriptions and body text. Do not use `300` (too thin for dark backgrounds) or `800`+.

**Letter-spacing rules:**
- Large headings (`28px`+): `letter-spacing: -0.02em` — tight, professional.
- Normal body and labels: `letter-spacing: -0.01em` or default.
- Section headers (11px uppercase): `letter-spacing: 0.08em` — wider tracking is needed when text is uppercase and small.
- Form labels (12px uppercase): `letter-spacing: 0.05em`.
- Do not add wide letter-spacing to any non-uppercase text. `letter-spacing: 0.1em` on a normal sentence is an immediately recognizable AI UI tell.

---

### Layout & Spacing

**Play screen:** Two-column CSS grid — left sidebar `var(--sidebar-width) = 220px`, right content `1fr`. This is structural. Do not add a third column, a right panel, or a bottom dock without explicit discussion.

**Spacing scale:** All padding and gaps use multiples of 4px. Common values: `4, 8, 10, 12, 14, 16, 20, 24, 28, 32`. Avoid values like `18px`, `22px`, or `26px` — they look like rounding errors and read as unintentional.

**Navbar:** `48px` tall. Fixed. Not negotiable.

**Modal widths:** Standard `440px`. New installation form `500px`. Confirm dialog `380px`. Do not exceed `600px` for any modal. Modal internal padding is always `28px`.

**Settings page:** Centered column, `max-width: 600px`, `padding: 32px`.

**Section headers** inside panels: `11px`, `font-weight: 600`, `text-transform: uppercase`, `letter-spacing: 0.08em`, `color: var(--text-muted)`. They label regions of content, not headings for reading.

---

### Buttons

There are exactly six button variants. Do not invent new ones without a design discussion.

1. **`.btn-primary`** — Solid `var(--accent)` fill, `color: #000` (black text on green is intentional — it is accessible and avoids the washed-out look of white on green), `font-weight: 600`. Used for the single most important action in a context.
2. **`.btn-secondary`** — `var(--bg-elevated)` fill, `1px var(--border-color)`, `color: var(--text-secondary)`. Default for most action buttons.
3. **`.btn-ghost`** — Transparent background, transparent border, `color: var(--text-muted)`. For tertiary actions that should visually recede.
4. **`.btn-danger`** — Transparent background with `rgba(239,68,68,0.20)` border and `#F87171` text. Hover state deepens the red. **Never use solid red as the default state** for a destructive button — the solid fill is reserved for the hover/active press state. The low-opacity default communicates danger without screaming it.
5. **`.btn-icon`** — Square icon-only button, `var(--control-height)` × `var(--control-height)`.
6. **Dashed "add" button** (`.new-installation-btn`) — `border: 1px dashed var(--border-hover)`. The dashed border is the universal affordance for "create something new" (used in VS Code, Figma, Notion). On hover it shifts to a dashed accent border with `var(--accent-muted)` fill.

**Size modifiers:** `.btn-sm` (`28px` height), default (`34px`), `.btn-lg` (`40px`).

**Hover behavior:** Hover changes `background` and `color` only. Zero `transform: translateY(-Npx)`, zero `transform: scale(1.0N)`, zero box-shadow change. A button must feel **anchored** to the layout.

**Active state:** Slightly darker background than hover. No `scale(0.98)` "press" effect. No inset shadow.

**The play button** is 196×52px. Its size is its weight. Do not add a glow, drop shadow, gradient, shimmer sweep, or pulse animation to it under any circumstances.

---

### Selection & Active States

**List item selection uses the inset accent bar:**
```css
box-shadow: inset 2px 0 0 var(--accent);
background: var(--bg-elevated);
```
This is the singular way to indicate "selected" in a list. It is a left-edge vertical stroke. Do not replace it with a full-perimeter green border, a green background fill, a checkmark overlay, or any other pattern. The left bar is a convention borrowed from VS Code's file explorer and Linear's list views — it communicates selection without dominating the visual field.

**Tab navigation uses the bottom underline:**
```css
.navbar-tab.active::after {
  height: 2px;
  background: var(--accent);
  /* bottom edge, scoped to the tab's text width via left/right: 16px */
}
```
Active tab text is `var(--text-primary)`. No background pill, no box-shadow, no filled tab container.

---

### Inputs & Forms

**All inputs** use `var(--bg-input)` (darker than the card surface — this depth inversion makes the field look recessed into the page, which is a subtle but important affordance that says "you can type here"). `1px var(--border-color)` ring. On focus: **border-color changes to `var(--border-focus)`**. That is the only focus indicator. No `box-shadow: 0 0 0 3px rgba(34,197,94,0.3)` glow ring. A color change on the border is sufficient and cleaner.

**Form labels:** `12px`, `font-weight: 500`, `text-transform: uppercase`, `letter-spacing: 0.05em`, `color: var(--text-muted)`. Always positioned above the input with `margin-bottom: 8px`. Never floating labels, never placeholder-as-label.

**Selects** use `appearance: none` and a custom SVG chevron injected via `background-image` as a data URI. They share all input visual styles.

**Toggle switches** are `44×24px` (small: `36×20px`). Track uses `--radius-full`. Off state: `var(--bg-input)` track, `var(--text-muted)` thumb. On state: `var(--accent)` track, `#fff` thumb. The thumb slides via `transform: translateX(20px)`. No shadow on the thumb in the on state. No scale animation.

---

### Icons

All icons are **inline SVG components** defined at the top of `src/App.tsx`. They follow the Lucide icon visual language: stroke-based, `strokeWidth="1.4"`, `strokeLinecap="round"`, `strokeLinejoin="round"`. Viewport is `14×14`. They are `aria-hidden="true"`.

**Rules for icons:**
- Never use emoji as icons. Not `🎮`, `⚙️`, `🔧`, `🗑️`, or anything else. This is the single fastest way to make a UI look unfinished.
- Never use filled flat icons (Font Awesome 4 style). They are visually incompatible with the stroke set.
- Never mix stroke icons and filled icons in the same view.
- Always use `currentColor` as the stroke/fill — never hardcode a color on an SVG path directly.
- `width` and `height` on the SVG element: `14` for inline icons, `13` for slightly tighter contexts. Do not use `16` or `18` without a layout reason.
- When adding a new icon, define it at the top of `App.tsx`, name it `IconNoun`, match `strokeWidth="1.4"` exactly, and verify it is visually consistent with the existing set.

---

### Modals & Overlays

Overlay: `position: fixed`, full viewport, `background: rgba(0,0,0,0.75)`, `backdrop-filter: blur(8px)`. Fades in with `@keyframes fadeIn` at `0.2s`. The blur is intentional — it tells the user the background is still there but inaccessible, and the dark tint dims it without hiding it.

Modal card entrance: `@keyframes slideUp` — `translateY(20px) scale(0.98)` to `translateY(0) scale(1)` at `0.25s`. The `20px` offset and the `0.98` scale are deliberately subtle. They communicate "the modal emerged from below" without being dramatic or distracting. Do not change this to `translateY(60px)`, do not add a bounce, do not change the duration to `0.5s`.

Modal `h3` header: `20px`, `font-weight: 600`, `letter-spacing: -0.02em`, `margin-bottom: 24px`. No divider line under the header. No close × button floating in the top-right corner — dismissal happens via action buttons only (a design pattern that forces explicit intent rather than accidental dismissal).

Form action button order: **primary action first (left), cancel last (right)**. This is the consistent order throughout the app.

---

### Animations — Allowed vs. Forbidden

**Allowed:**
- `@keyframes spin` on the loading spinner: `1s linear infinite`. Exactly this.
- `@keyframes progress-indeterminate`: slides across the progress bar, `1.1s ease-in-out infinite`.
- `@keyframes fadeIn` on modal overlay: `0.2s` opacity.
- `@keyframes slideUp` on modal card: `0.25s`, subtle Y + scale entrance.
- `@keyframes slideDown` on the update banner: `0.3s`.
- CSS `transition` on hover/focus/active states using `--transition-fast` or `--transition-normal` for `background`, `color`, `border-color`.

**Forbidden — no exceptions:**
- Pulsing glow animation on anything in a "running" or "active" state. A static color change is sufficient and more professional.
- Bounce, elastic, or spring easing on any animation.
- `transform: scale()` on hover for any button or card. The single exception is the modal entrance where `0.98 → 1.0` is used (and is imperceptible unless you're looking for it).
- Shimmer/skeleton loading animations on any element.
- Staggered entrance animations on list items.
- Confetti, celebration, or particle effects.
- Any `animation` property on an element that does not require looping feedback (loading, progress).

---

### State Communication Without Animation

AI-generated UIs communicate state by animating everything — pulsing dots, glowing rings, bouncing icons. This codebase communicates state through **static color and text changes only**:

| State | How It Is Communicated |
|---|---|
| **Downloading** | Play button background → `var(--bg-elevated)`, text → "Downloading..." or phase label, progress bar appears above, button disabled. |
| **Running** | Play button gets `border: 1px solid var(--accent)`, `color: var(--accent)`, `background: var(--bg-elevated)`. Text → "Running". No animation. The static green border is the signal. |
| **Disabled** | `opacity: 0.4` or `0.45`. No shimmer, no strikethrough. |
| **Error** | `var(--danger)` text on `var(--danger-muted)` background strip, `1px var(--danger)` bottom border. Inline banner, not a modal. |
| **Selected item** | Inset left accent bar + `var(--bg-elevated)` background + version chip switches to `var(--accent-muted)` fill and `var(--accent)` text. |
| **Initial loading** | Centered CSS spinner (border-top trick), secondary text label below. Not a skeleton screen. |
| **Focus** | Border color changes to `var(--border-focus)`. No glow ring. |

---

### The "Not AI-Generated" Checklist

Before finishing any new UI element, run through this list. If any item is present, remove it before committing:

- [ ] Gradient on a button or card background — **Remove. Use flat fill.**
- [ ] `box-shadow` with a colored (non-black) value — **Remove. Shadows are depth, not glow.**
- [ ] `transform: translateY(-Npx)` on hover — **Remove. Hover = color change only.**
- [ ] `transform: scale(1.0N)` on hover — **Remove.**
- [ ] `border-radius` above `10px` on anything non-circular — **Use the token system.**
- [ ] A second accent color introduced — **There is one accent. Reject all others.**
- [ ] An animation on a stable/running state — **Static color is enough.**
- [ ] `letter-spacing: 0.08em` or wider on non-uppercase text — **Wide tracking is for uppercase labels only.**
- [ ] `border: 2px solid ...` on any interactive element — **All borders in this system are 1px.**
- [ ] Multiple accent colors on a grid of cards — **One accent, everything else is zinc.**
- [ ] Emoji in any label, button, or heading — **Forbidden.**
- [ ] `background: linear-gradient(...)` anywhere — **Not present anywhere. Must not be introduced.**
- [ ] New CSS values written as literals instead of tokens — **All values belong in `:root` in `App.css`.**
- [ ] Inline `style={{ color: '#22C55E' }}` or similar hardcoded values in JSX — **Use CSS classes and token variables.**
- [ ] An icon that is filled/solid when all others in the view are stroke — **Match the stroke style.**
- [ ] A modal that is wider than `500px` — **Keep modals constrained.**
- [ ] Any element with a new font weight that is not already used in the system (`300`, `800`, `900`) — **Use existing weight scale.**

---

### Light Theme

A `[data-theme="light"]` override in `App.css` inverts the luminance of background and text tokens while preserving all structural relationships. The accent shifts one step darker in light mode so it stays accessible on white. When adding new styles: **if you use only `var(--bg-*)`, `var(--text-*)`, `var(--border-*)`, and `var(--shadow-*)` tokens, light theme works automatically**. If you write a literal color like `background: #09090B`, it will not adapt. Always use tokens.

### Crash Recovery

The launcher has automatic startup crash recovery. If Minecraft exits with a non-zero code within 90 seconds of launch, it re-runs mod sync and relaunches automatically up to 2 times. That recovery path is not just a redownload: it can surface persisted `modIssues`, disable incompatible mods during dependency validation, and repair known startup config-parse crashes before retrying. This is handled in the `game:launch` IPC flow in `main.ts`.

### Auto-updater

Uses `electron-updater` pointing at GitHub releases (configured in `electron-builder.json5`). Only active in production builds — all auto-update IPC handlers return an error in dev mode. Update check runs 3 seconds after app startup.

---

## Collaboration Philosophy

### Act Like a Colleague, Not a Slave

Claude should never blindly execute instructions without applying professional judgment. The relationship is a **peer engineering collaboration**, not a command-execution service. This means:

- **Push back on bad decisions.** If Jonas asks for something that will create a security hole, introduce a known anti-pattern, break an architectural constraint, or produce a worse outcome than an obvious alternative — say so clearly and directly before doing anything. Do not silently implement something known to be wrong.
- **Propose better options.** If a cleaner, more maintainable, or more correct approach exists, name it. Do not withhold it out of deference. A one-sentence note like "this works, but approach X is cleaner because Y — want me to use that instead?" takes five seconds and can prevent hours of rework.
- **Flag contradictions.** If a request contradicts something already in CLAUDE.md, something already in the codebase, or a decision made earlier in the same session — surface that contradiction explicitly. Do not pick a side silently.
- **Ask when the intent is genuinely ambiguous.** If the request could reasonably mean two different things with different implementation consequences, ask which one is meant before writing code. Do not guess and implement the wrong one. Keep clarifying questions to a minimum — one or two focused questions, not an interrogation.
- **Do not over-defer on taste.** If Jonas requests a UI element that violates the design rules in this file (gradient, glow, emoji, etc.) and it appears to be an oversight rather than a deliberate override, point out the violation and ask for confirmation before implementing it. A conscious override is fine; silent violation is not.

The goal is to catch mistakes *before* they get implemented, not to agree with everything and then produce broken or inferior code.

---

## Prompt Execution Protocol

### Read Thoroughly, Then Plan Before Acting

Before writing a single line of code or making any file change, Claude must:

1. **Read the entire prompt.** Do not start executing on the first sentence and miss a constraint buried in the last one. A prompt that says "add a new mod panel, make sure it uses the existing card styles, and don't touch the mods tab logic" contains three separate requirements. Miss one and the work is wrong.

2. **Decompose every request into a concrete todo list.** Every prompt that involves more than one action must be broken down into explicit numbered tasks before any work begins. Use the todo list tool to track them. Each task should be specific enough that "done" has an unambiguous meaning — not "fix the UI" but "add `.mod-panel` CSS class matching existing card styles".

3. **Work the list top-to-bottom, marking items complete as you go.** Never skip ahead, never leave an item half-done to come back to. If a later item turns out to be blocked by or contradicted by an earlier one, surface that instead of silently skipping it.

4. **Do not report completion until every item on the list is done.** If something is blocked, say so explicitly — do not close out the response with "done!" while leaving items unfinished.

5. **Never forget a trailing requirement.** Small parenthetical instructions at the end of a prompt ("...and make sure it compiles", "...and update the type in index.ts") are as mandatory as the main request. The todo list exists specifically to prevent these from being dropped.
