# JojoClient — Design Instructions

> **Version:** 1.0 | **Authoritative reference for all JojoClient visual design.**  
> This document is the single source of truth for colors, typography, spacing, components, animation, and brand identity across the website (`jojoclient.html` / `docs/`) and the Electron desktop app (`src/App.tsx` / `src/App.css`). No visual change may be implemented without consulting this document.

---

## Table of Contents

1. [Core Philosophy](#1-core-philosophy)
2. [Brand & Logo](#2-brand--logo)
3. [Design Tokens — App](#3-design-tokens--app)
4. [Design Tokens — Website](#4-design-tokens--website)
5. [Color System](#5-color-system)
6. [Typography](#6-typography)
7. [Spacing & Layout](#7-spacing--layout)
8. [Icons](#8-icons)
9. [Buttons](#9-buttons)
10. [Inputs, Forms & Selects](#10-inputs-forms--selects)
11. [Modals & Overlays](#11-modals--overlays)
12. [Selection & Active States](#12-selection--active-states)
13. [State Communication](#13-state-communication)
14. [Animations & Motion](#14-animations--motion)
15. [Website — Landing Page Design](#15-website--landing-page-design)
16. [Website — Legal Pages Design](#16-website--legal-pages-design)
17. [App — Layout & Shell](#17-app--layout--shell)
18. [App — Setup & Loading Screens](#18-app--setup--loading-screens)
19. [App — Play Screen](#19-app--play-screen)
20. [The Forbidden List (Anti-AI Checklist)](#20-the-forbidden-list-anti-ai-checklist)
21. [Implementation Rules](#21-implementation-rules)
22. [File Map](#22-file-map)

---

## 1. Core Philosophy

**JojoClient is a tool, not a marketing product.** Every visual decision must feel deliberate and restrained — the aesthetic of VS Code, Linear, Zed, or Warp. Never a Dribbble showcase or AI-generated "modern dark UI."

### Hard Principles

- **One accent color:** Green (`#22C55E`). One. Not two, not "green plus a complementary blue." One.
- **Flat surfaces:** All backgrounds are solid colors. No gradients anywhere. No glass effects on cards.
- **Depth through luminance:** Depth hierarchy expressed exclusively through six zinc-family background layers — darker = deeper, lighter = closer. Supported by black-only shadows.
- **No animation on stable states:** State is communicated through static color and text changes. Animation is reserved for feedback (loading, progress, entrance of transient UI).
- **Restraint wins:** When in doubt, do less. A plain flat button beats an animated one. A border-color change beats a glow ring.

---

## 2. Brand & Logo

### Logo: Voxel Cube

The JojoClient logo is an **isometric voxel cube** composed of white block facets with intentional gaps creating a 3D effect, on a black rounded square background.

**Source file:** `jojoclient_logo_voxel_cube.svg` (full version, 680×360 viewBox)

**App icon file:** `public/icon.svg` (square version, 280×280 viewBox, for favicons, window icons, and conversion to app icons)

### Logo Usage Rules

| Context | Size | Format | Notes |
|---|---|---|---|
| Website navbar | 24×24px | Inline SVG | Next to "JojoClient" text, `flex-shrink: 0`, `gap: 8px` |
| Website footer | 20×20px | Inline SVG | Same layout context as navbar |
| Electron app navbar | 22×22px | JSX SVG | Next to "JojoClient" text, `gap: 10px` |
| Electron app setup screen | 64×64px | JSX SVG | Centered above heading, `margin-bottom: 24px` |
| App icon / favicon | 280×280 (scalable) | SVG file | `public/icon.svg`; convert to 512×512 PNG for `electron-builder` |
| Browser tab favicon | Vector | `icon.svg` | Referenced by `<link rel="icon">` on all pages |

### Logo SVG (Square Icon Version)

```svg
<svg width="280" height="280" viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg">
  <rect width="280" height="280" rx="40" fill="#000"/>
  <polygon points="140,46 173,65 140,84 107,65" fill="#fff"/>
  <polygon points="183,71 216,90 183,109 150,90" fill="#fff"/>
  <polygon points="97,71 130,90 97,109 64,90" fill="#fff"/>
  <polygon points="140,96 173,115 140,134 107,115" fill="#fff"/>
  <polygon points="145,143 178,124 178,162 145,181" fill="#fff"/>
  <polygon points="188,118 221,99 221,137 188,156" fill="#fff"/>
  <polygon points="145,193 178,174 178,212 145,231" fill="#fff"/>
  <polygon points="188,168 221,149 221,187 188,206" fill="#fff"/>
  <polygon points="59,99 92,118 92,156 59,137" fill="#fff"/>
  <polygon points="102,124 135,143 135,181 102,162" fill="#fff"/>
  <polygon points="59,149 92,168 92,206 59,187" fill="#fff"/>
  <polygon points="102,174 135,193 135,231 102,212" fill="#fff"/>
</svg>
```

### Logo Inline Snippet (for navbar/footer use with cropped viewBox)

```svg
<svg width="24" height="24" viewBox="200 40 280 280" aria-hidden="true" style="flex-shrink:0">
  <rect x="200" y="40" width="280" height="280" rx="40" fill="#000"/>
  <polygon points="340,86 373,105 340,124 307,105" fill="#fff"/>
  <polygon points="383,111 416,130 383,149 350,130" fill="#fff"/>
  <polygon points="297,111 330,130 297,149 264,130" fill="#fff"/>
  <polygon points="340,136 373,155 340,174 307,155" fill="#fff"/>
  <polygon points="345,183 378,164 378,202 345,221" fill="#fff"/>
  <polygon points="388,158 421,139 421,177 388,196" fill="#fff"/>
  <polygon points="345,233 378,214 378,252 345,271" fill="#fff"/>
  <polygon points="388,208 421,189 421,227 388,246" fill="#fff"/>
  <polygon points="259,139 292,158 292,196 259,177" fill="#fff"/>
  <polygon points="302,164 335,183 335,221 302,202" fill="#fff"/>
  <polygon points="259,189 292,208 292,246 259,227" fill="#fff"/>
  <polygon points="302,214 335,233 335,271 302,252" fill="#fff"/>
</svg>
```

### Brand Name

The brand name is **"JojoClient"** — one word, capital J, capital C. Never split or hyphenated.

- App window title: `JojoClient`
- Website page title: `JojoClient — Minecraft, finally a tool`
- App navbar text: `JojoClient` (always accompanied by logo SVG at 10px gap)
- Copyright line: `© 2026 TFR Consulting UG · Not affiliated with Mojang or Microsoft`
- `electron-builder.json5` productName: `"JojoClient"`
- `electron-builder.json5` appId: `"com.jojoclient.app"`
- `package.json` name: `"jojoclient"` (lowercase, npm convention)
- IPC bridge namespace: `window.jojoclient` (lowercase)
- User-Agent HTTP header: `"JojoClient"`
- Minecraft launcher brand JVM arg: `-Dminecraft.launcher.brand=JojoClient`

---

## 3. Design Tokens — App

All app visual values live in `:root` in `src/App.css`. Never hardcode a color, spacing, shadow, or radius that has a token. Use `var(--token-name)` exclusively.

### Background Layers — Zinc Family (Deepest → Shallowest)

| Token | Dark Value | Light Value | Used For |
|---|---|---|---|
| `--bg-base` | `#09090B` | `#F4F4F5` | App shell, page backgrounds. Darkest layer. |
| `--bg-surface` | `#111113` | `#FFFFFF` | Sidebar panels, navbar surface. |
| `--bg-elevated` | `#18181B` | `#FFFFFF` | Elevated interactions, hover fill states. |
| `--bg-card` | `#1C1C1F` | `#FFFFFF` | Cards, modals, list items. The "content" surface. |
| `--bg-card-hover` | `#232327` | `#F4F4F5` | Hovered card/row background. **Hover only.** |
| `--bg-input` | `#0D0D10` | `#FAFAFA` | Input fields, code areas. Darker than base — depth inversion makes fields look recessed. |

**Rule:** Never invent a seventh background layer. The six-level system is complete and intentional.

### Text — Four Levels

| Token | Dark Value | Light Value | Used For |
|---|---|---|---|
| `--text-primary` | `#FAFAFA` | `#18181B` | Headings, selected states, active labels. Use sparingly. |
| `--text-secondary` | `#A1A1AA` | `#52525B` | Body text, default UI labels. |
| `--text-muted` | `#52525B` | `#A1A1AA` | Captions, placeholders, section headers (uppercase 11–12px). |
| `--text-disabled` | `#3F3F46` | `#D4D4D8` | Disabled form controls only. |

### Accent — One Color Only

| Token | Dark Value | Light Value | Usage |
|---|---|---|---|
| `--accent` | `#22C55E` | `#16A34A` | Primary buttons, selected indicators, focused borders, accent text. |
| `--accent-hover` | `#16A34A` | `#15803D` | Hover state for accent-colored elements. Always **darker**. |
| `--accent-muted` | `rgba(34,197,94,0.08)` | `rgba(22,163,74,0.08)` | Semi-transparent fill behind accent-colored text. Selected badges, active chips. |

**Hover always darkens, never lightens.** Hover = `--accent-hover`.

### Semantic Colors — State Only, Never Decoration

| Token | Value | Used For |
|---|---|---|
| `--success` / `--success-muted` | `#22C55E` / `rgba(34,197,94,0.10)` | Positive confirmation banners only. |
| `--warning` / `--warning-muted` | `#F59E0B` / `rgba(245,158,11,0.10)` | Warning banners only. |
| `--danger` / `--danger-muted` | `#EF4444` / `rgba(239,68,68,0.10)` | Error states, destructive button styling. |
| `--info` / `--info-muted` | `#3B82F6` / `rgba(59,130,246,0.10)` | Informational banners only. |

Semantic colors are **only for status communication** — never used as alternative accents or decorative flourishes.

### Borders — 1px Only

| Token | Value | Used For |
|---|---|---|
| `--border-color` | `rgba(255,255,255,0.07)` | Default ring on cards and containers. |
| `--border-subtle` | `rgba(255,255,255,0.03)` | Hairline dividers inside components. |
| `--border-focus` | `rgba(34,197,94,0.40)` | Focus state on inputs — border color change, no glow. |
| `--border-hover` | `rgba(255,255,255,0.12)` | Border on hovered interactive elements. |

**All borders are 1px.** The inset selection bar (`box-shadow: inset 2px 0 0 var(--accent)`) appears 2px wide but is a box-shadow, not a border — a deliberate exception.

### Shadows — Black Depth Only

| Token | Value |
|---|---|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.5)` |
| `--shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.4), 0 2px 4px -2px rgba(0,0,0,0.3)` |
| `--shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.5), 0 4px 6px -4px rgba(0,0,0,0.4)` |
| `--shadow-card` | `0 1px 3px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.04)` |

**Shadows express depth, never attention.** No colored shadows (`rgba(34,197,94,…)`). All shadows use `rgba(0,0,0,…)` only. The `--shadow-card` inset ring creates a barely-visible top-edge brightening that reads as material depth.

### Border Radii — Tight and Tool-Like

| Token | Value | Used For |
|---|---|---|
| `--radius-xs` | `3px` | Tiny badges, code spans, version chips. |
| `--radius-sm` | `4px` | Small buttons, inline chips. |
| `--radius-md` | `6px` | Standard buttons, cards, default controls. Most-used value. |
| `--radius-lg` | `8px` | Inputs, selects, panels. |
| `--radius-xl` | `10px` | Modals, settings sections. |
| `--radius-full` | `9999px` | Pills, toggle tracks, progress bars, scrollbar thumbs **only**. |

Never use `border-radius: 16px`, `20px`, `24px`, or `50%` on anything not truly circular.

### Layout Tokens

| Token | Value | Used For |
|---|---|---|
| `--navbar-height` | `48px` | Top navigation bar. Fixed. Not negotiable. |
| `--sidebar-width` | `220px` | Left sidebar on Play screen. |
| `--panel-bottom-gap` | `12px` | Gap below panel content. |
| `--panel-action-height` | `38px` | Height of panel action bar. |
| `--control-height` | `34px` | Default control height (buttons, inputs). |
| `--control-height-sm` | `28px` | Small control height. |
| `--control-height-lg` | `40px` | Large control height. |
| `--control-padding-x` | `14px` | Horizontal padding for controls. |

### Transitions — Crisp, Not Elastic

| Token | Value | Used For |
|---|---|---|
| `--transition-fast` | `0.12s cubic-bezier(0.4,0,0.2,1)` | Hover color changes, focus border changes. |
| `--transition-normal` | `0.2s cubic-bezier(0.4,0,0.2,1)` | Card hover states, tab switching. |
| `--transition-slow` | `0.3s cubic-bezier(0.4,0,0.2,1)` | Modal entrance animations. |

The easing curve `cubic-bezier(0.4, 0, 0.2, 1)` — Material Design "standard" — accelerates out of rest and decelerates into the end state. It feels mechanical and direct, not bouncy. Never use spring or bounce easing (cubic-bezier values outside 0–1 range).

### Monospace Font Token

```css
--font-mono: 'JetBrains Mono', 'SF Mono', 'Consolas', 'Monaco', monospace;
```

---

## 4. Design Tokens — Website

The website uses a parallel token system in `jojoclient.html` / `docs/` that is visually identical to the app but uses different token names and a slightly reduced palette (no semantic colors, fewer layers).

| Token | Value | Maps to App Token |
|---|---|---|
| `--bg` | `#09090B` | `--bg-base` |
| `--surface` | `#111113` | `--bg-surface` |
| `--elevated` | `#18181B` | `--bg-elevated` |
| `--card` | `#1C1C1F` | `--bg-card` |
| `--card-hover` | `#232327` | `--bg-card-hover` |
| `--text` | `#FAFAFA` | `--text-primary` |
| `--text-sec` | `#A1A1AA` | `--text-secondary` |
| `--text-muted` | `#52525B` | `--text-muted` |
| `--accent` | `#22C55E` | `--accent` |
| `--accent-hover` | `#16A34A` | `--accent-hover` |
| `--accent-muted` | `rgba(34,197,94,0.08)` | `--accent-muted` |
| `--border` | `rgba(255,255,255,0.07)` | `--border-color` |
| `--border-hover` | `rgba(255,255,255,0.12)` | `--border-hover` |
| `--border-accent` | `rgba(34,197,94,0.28)` | (website-specific — accent border for section labels) |
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.5)` | `--shadow-sm` |
| `--shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.4), 0 2px 4px -2px rgba(0,0,0,0.3)` | `--shadow-md` |
| `--shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.5), 0 4px 6px -4px rgba(0,0,0,0.4)` | `--shadow-lg` |
| `--radius-sm` | `4px` | `--radius-sm` |
| `--radius-md` | `6px` | `--radius-md` |
| `--radius-lg` | `8px` | `--radius-lg` |
| `--radius-xl` | `10px` | `--radius-xl` |
| `--font-mono` | `'JetBrains Mono', 'SF Mono', 'Consolas', 'Monaco', monospace` | `--font-mono` |
| `--transition-fast` | `0.12s cubic-bezier(0.4,0,0.2,1)` | `--transition-fast` |
| `--transition-normal` | `0.2s cubic-bezier(0.4,0,0.2,1)` | `--transition-normal` |
| `--transition-slow` | `0.3s cubic-bezier(0.4,0,0.2,1)` | `--transition-slow` |

### Website-Exclusive Effect: Film Grain

The website includes a subtle **film grain overlay** applied via `body::before`:

```css
body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 100;
  pointer-events: none;
  opacity: 0.022;
  background-image: url("data:image/svg+xml,<fractalNoise SVG>");
  background-repeat: repeat;
  background-size: 300px 300px;
}
```

This is a website-only treatment. It adds subtle texture without being visually loud. The `opacity: 0.022` is intentional — it should be barely perceptible, not a heavy grain effect.

### Website Base Typography

```css
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
```

The website uses a `zoom: 1.5` on `<html>` — this is a deliberate scaling factor. All font sizes and spacing are computed relative to this.

---

## 5. Color System

### The One Accent Rule

There is **exactly one accent color**: `#22C55E` (green, dark theme) / `#16A34A` (light theme).

- The semantic colors (`--warning`, `--danger`, `--info`) exist **only** for their specific state roles: warning banners, error states, informational banners. They are never used as decorative accents.
- No second decorative accent may be introduced. No blue, purple, or teal on the grounds that it "looks nice."

### Hover Behavior

- Accent hover **always darkens** (`--accent-hover`). Never lightens.
- Generic interactive hover (non-accent): `background` or `border-color` changes via `--transition-fast`. No transform, no scale, no shadow change.

### Depth Hierarchy

Depth is expressed through the six background layers. The darkest layer (`--bg-base = #09090B`) is the deepest (page background, app shell). Each step up is slightly lighter. The `--bg-input` layer inverts this — it is darker than the card surface to create a "recessed" affordance.

### Light Theme

A `[data-theme="light"]` override on `:root` inverts the luminance of background and text tokens while preserving all structural relationships. The accent shifts one step darker. If you use only `var(--bg-*)`, `var(--text-*)`, `var(--border-*)`, and `var(--shadow-*)` tokens, light theme works automatically. A literal color will not adapt.

---

## 6. Typography

### Font Stack — Body

```
'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
```

- Base size: `14px` (app) / `16px` (website)
- Line-height: `1.5`
- `-webkit-font-smoothing: antialiased`
- `letter-spacing: -0.01em` (slightly tight, reads as "designed")

### Font Stack — Monospace

```
'JetBrains Mono', 'SF Mono', 'Consolas', 'Monaco', monospace
```

Used **exclusively** for computer-generated identifiers:
- Minecraft version strings (`1.21.4`)
- Fabric loader versions
- RAM values (`8192 MB`)
- UUIDs
- Log output
- File paths

Never use monospace for button labels, UI text, descriptions, or headings.

### Font Size Scale

Only these sizes are used across the entire project:

| Size | App Usage | Website Usage |
|---|---|---|
| `10px` | Smallest badge text only | — |
| `11px` | Version chips, section header labels, badges | Section labels (mono, uppercase) |
| `12px` | Form labels (uppercase), captions | Stat labels, version chips |
| `13px` | Button labels, input text, secondary body | Nav download button, footer links, meta/chip text |
| `14px` | Primary body text, list item names | Nav/footer brand text |
| `16px` | Brand name in navbar | Body text, feature descriptions |
| `20px` | Modal headings, account username | — |
| `28px` | Page headings, setup card heading | — |
| Clamp values | — | Hero: `clamp(2.9rem, 4.4vw, 4.4rem)`; Feature: `clamp(2rem, 3vw, 2.9rem)` |

**Do not invent sizes:** 15, 17, 19, 22, 24, 32, or any other uncatalogued size.

### Font Weights

| Weight | Used For |
|---|---|
| `400` | Descriptions, body text. |
| `500` | Standard button labels, list item names, form input text. |
| `600` | Active tab text, modal headers, primary buttons, feature headings, nav brand text. **The "bold enough" weight.** |
| `700` | Page-level headings, app navbar brand. **The "most prominent" weight.** |

**Do not use:** `300` (too thin for dark backgrounds), `100`, `200`, `800`, `900`.

### Letter-Spacing Rules

| Context | Value | Applies To |
|---|---|---|
| Large headings (28px+) | `-0.02em` | App page headings, setup card h1 |
| Website feature headings | `-0.03em` | `.feature-text h2`, `.cta-inner h2` |
| Website hero heading | `-0.035em` | `.hero-text h1` |
| Brand text | `-0.02em` | Nav/footer logo text |
| Normal body and UI labels | `-0.01em` or default | Most text |
| Section headers (11px uppercase) | `0.08em` | App panel section headers |
| Website section labels (11px uppercase) | `0.12em` | `.section-label` (mono, accent-colored) |
| Form labels (12px uppercase) | `0.05em` | Form field labels |
| Stat labels (12px uppercase) | `0.08em` | `.stat-label` (mono) |

**Never add `letter-spacing` ≥ 0.05em to non-uppercase text.** Wide tracking on sentence-case is an immediately recognizable AI UI tell.

---

## 7. Spacing & Layout

### Spacing Scale

All padding, margin, and gap values use **multiples of 4px**. The canonical set:

```
4, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 80, 96, 100, 120, 140, 160
```

**Avoid:** `18px`, `22px`, `26px`, `30px`, or any value not in the scale above. They look like rounding errors and read as unintentional.

### Layout Constants

| Property | Value | Context |
|---|---|---|
| Navbar height (app) | `48px` | Fixed. Not negotiable. |
| Navbar height (website) | `64px` | Fixed. |
| Sidebar width | `220px` | Play screen left sidebar. |
| Website max-width | `1360px` | All website content containers. |
| Website nav padding | `48px` horizontal | `.nav-inner` |
| Hero section padding | `160px` top, `120px` bottom | Desktop |
| Feature section padding | `140px` top/bottom | Desktop |
| CTA section padding | `160px` top/bottom | Desktop |
| Stat strip padding | `56px` top/bottom | Desktop |
| Footer padding | `32px` top/bottom | Desktop |
| Legal page padding | `120px` top, `80px` bottom | Desktop |
| Legal content max-width | `720px` | `.legal-inner` |
| Modal width (standard) | `440px` | Default modal |
| Modal width (install form) | `500px` | New installation form |
| Modal width (confirm) | `380px` | Confirm dialog |
| Modal max-width | `600px` | Never exceed |
| Modal internal padding | `28px` | All modals |
| Settings page max-width | `600px` | Centered column |
| Settings page padding | `32px` | |

### Play Screen Layout

Two-column CSS grid:
```
grid-template-columns: var(--sidebar-width) 1fr
```
- Left: sidebar (`220px` fixed)
- Right: content area (`1fr`, fills remaining space)

This is structural. Do not add a third column, right panel, or bottom dock.

### Responsive Breakpoints (Website Only)

| Breakpoint | Pivot |
|---|---|
| `1040px` | Two-column grids collapse to single column; screenshot transforms removed; paddings reduce |
| `640px` | Further padding reduction; hero/footer restack; stat strip becomes vertical |

---

## 8. Icons

All icons are **inline SVG components** defined at the top of `src/App.tsx`. They follow the Lucide visual language.

### Icon Construction Rules

- **ViewBox:** `14×14` (or `13×13` for tighter contexts)
- **Stroke:** `strokeWidth="1.4"` (or `1.3` for 13px)
- **Style:** `strokeLinecap="round"`, `strokeLinejoin="round"`
- **Color:** `stroke="currentColor"` or `fill="currentColor"` — never a hardcoded color
- **Accessibility:** `aria-hidden="true"`
- **Naming:** `IconNoun` (PascalCase, e.g., `IconFolder`, `IconArrowLeft`, `IconTrash`)

### Icon Rules

- **Never** use emoji as icons. Not `🎮`, `⚙️`, `🔧`, `🗑️`, `▶️`, `✨`, or anything else.
- **Never** use filled flat icons (Font Awesome 4 style). Incompatible with the stroke set.
- **Never** mix stroke icons and filled icons in the same view.
- All icons use `currentColor` — they inherit color from their parent context.
- When adding a new icon, match `strokeWidth="1.4"` exactly and verify visual weight against the existing set.

### Website Icons

The website uses ad-hoc inline SVGs rather than React components, but follows the same rules: stroke-based, `currentColor`, `aria-hidden="true"`, no emoji.

---

## 9. Buttons

There are exactly **six button variants** in the system. Do not invent new ones.

### 1. `.btn-primary`
```css
background: var(--accent);
color: #000;          /* black text on green — intentional for accessibility */
font-weight: 600;
border: none;
```
The single most important action in a context. **Black text on green, never white text on green.**

### 2. `.btn-secondary`
```css
background: var(--bg-elevated);
border: 1px solid var(--border-color);
color: var(--text-secondary);
```
Default for most action buttons.

### 3. `.btn-ghost`
```css
background: transparent;
border: 1px solid transparent;
color: var(--text-muted);
```
Tertiary actions that should visually recede.

### 4. `.btn-danger`
```css
background: transparent;
border: 1px solid rgba(239,68,68,0.20);
color: #F87171;
```
On hover: deepens the red (solid red fill only on hover/active). **Never solid red at rest.**

### 5. `.btn-icon`
```css
width: var(--control-height);
height: var(--control-height);
```
Square icon-only button.

### 6. Dashed "Add" Button (`.new-installation-btn`)
```css
border: 1px dashed var(--border-hover);
```
On hover: `border: 1px dashed var(--accent)`, `background: var(--accent-muted)`. The dashed border is the universal affordance for "create something new" (used in VS Code, Figma, Notion).

### Size Modifiers
| Class | Height |
|---|---|
| `.btn-sm` | `28px` |
| (default) | `34px` |
| `.btn-lg` | `40px` |

### Hover Behavior — All Buttons

Hover changes `background` and `color` only. **Zero `transform: translateY(-Npx)`, zero `transform: scale(1.0N)`, zero box-shadow change.** A button must feel anchored to the layout.

Active state: Slightly darker background than hover. No `scale(0.98)` "press" effect. No inset shadow.

### The Play Button

The play button is `196×52px`. Its size is its weight. **Do not add a glow, drop shadow, gradient, shimmer sweep, or pulse animation under any circumstances.** State changes:
- Idle: solid accent fill, black text
- Downloading: `var(--bg-elevated)` background, text → phase label, button disabled, progress bar above
- Running: `border: 1px solid var(--accent)`, `color: var(--accent)`, `background: var(--bg-elevated)`. Text → "Running". **No animation.** The static green border is the signal.

### Website Download Buttons

Website download buttons (`.hero-download`, `.cta-download`, `.nav-download`) follow the same pattern:
```css
background: var(--accent);
color: #052e16;       /* very dark green, nearly black */
font-weight: 600;
border-radius: var(--radius-md);
transition: background var(--transition-fast);
```
Sizes: nav `padding: 8px 16px; font-size: 13px`, hero `padding: 12px 24px; font-size: 14px`, CTA `padding: 16px 32px; font-size: 16px`.

---

## 10. Inputs, Forms & Selects

### Standard Input

```css
background: var(--bg-input);   /* darker than card — recessed affordance */
border: 1px solid var(--border-color);
border-radius: var(--radius-lg);
color: var(--text-secondary);
font-size: 13px;
font-weight: 500;
```

### Focus State

```css
border-color: var(--border-focus);
```
**That is the only focus indicator.** No `box-shadow: 0 0 0 3px rgba(34,197,94,0.3)` glow ring. A color change on the border is sufficient and cleaner.

### Form Labels

```css
font-size: 12px;
font-weight: 500;
text-transform: uppercase;
letter-spacing: 0.05em;
color: var(--text-muted);
margin-bottom: 8px;
```
Always positioned **above** the input. Never floating labels, never placeholder-as-label.

### Selects

Selects use `appearance: none` and a custom SVG chevron injected via `background-image` as a data URI. They share all input visual styles.

### Toggle Switches

Large: `44×24px` | Small: `36×20px`

- Track: `--radius-full`
- Off state: `var(--bg-input)` track, `var(--text-muted)` thumb
- On state: `var(--accent)` track, `#fff` thumb
- Thumb slides via `transform: translateX(20px)` (large) or `translateX(16px)` (small)
- **No shadow on the thumb in the on state. No scale animation.**

---

## 11. Modals & Overlays

### Overlay

```css
position: fixed;
inset: 0;
background: rgba(0,0,0,0.75);
backdrop-filter: blur(8px);
```
Fades in via `@keyframes fadeIn` at `0.2s`. The blur is intentional — it tells the user the background is still there but inaccessible. The dark tint dims it without hiding it.

### Modal Card

```css
background: var(--bg-card);
border: 1px solid var(--border-color);
border-radius: var(--radius-xl);
box-shadow: var(--shadow-lg);
padding: 28px;
```
Entrance via `@keyframes slideUp`: `translateY(20px) scale(0.98)` → `translateY(0) scale(1)` at `0.25s`. The `20px` offset and `0.98` scale are deliberately subtle. Do not change to `translateY(60px)`, do not add bounce, do not change to `0.5s`.

### Modal Header

```css
font-size: 20px;
font-weight: 600;
letter-spacing: -0.02em;
margin-bottom: 24px;
```
No divider line under the header. **No floating × close button** — dismissal happens via action buttons only.

### Action Button Order

**Primary action first (left), cancel last (right).** Consistent throughout the app.

---

## 12. Selection & Active States

### List Item Selection — Inset Accent Bar

```css
box-shadow: inset 2px 0 0 var(--accent);
background: var(--bg-elevated);
```
This is the singular way to indicate "selected" in a list. It is a left-edge vertical stroke. Do not replace with full-perimeter green border, green background fill, checkmark overlay, or any other pattern. The convention is borrowed from VS Code's file explorer and Linear's list views — communicates selection without dominating the visual field.

### Tab Navigation — Bottom Underline

```css
.navbar-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 16px;
  right: 16px;
  height: 2px;
  background: var(--accent);
}
```
Active tab text: `color: var(--text-primary)`, `font-weight: 600`. No background pill, no box-shadow, no filled tab container.

---

## 13. State Communication

State is communicated by **static color and text changes**, not animation. Use this table verbatim.

| State | Implementation |
|---|---|
| **Hover** (interactive element) | `background`, `color`, or `border-color` change via `--transition-fast`. No transform. No shadow change. |
| **Focus** (input/button) | Border color changes to `--border-focus`. Nothing else. No glow ring. |
| **Selected** (list row) | `box-shadow: inset 2px 0 0 var(--accent)` + `background: var(--bg-elevated)` + version chip: `var(--accent-muted)` background, `var(--accent)` text. |
| **Active tab** | Text → `--text-primary`, `font-weight: 600`, `::after` accent underline 2px. No pill. |
| **Running** (play button) | `border: 1px solid var(--accent)` + `color: var(--accent)` + `background: var(--bg-elevated)`. Text → "Running". **No pulse, no animation.** |
| **Downloading** (play button) | Background → `--bg-elevated`, label → phase text ("Downloading..." / "Libraries..." / etc.), button disabled, progress bar above. |
| **Disabled** | `opacity: 0.4` to `0.45`. No shimmer, no strikethrough. |
| **Error** | Inline banner: `var(--danger)` text on `var(--danger-muted)` background, `1px solid var(--danger)` bottom border. Not a modal. |
| **Loading** (initial) | Centered CSS border-top spinner (`1s linear infinite`) + `--text-muted` label below. Not a skeleton screen. |

---

## 14. Animations & Motion

### Allowed Animation Keyframes

| Keyframe | Duration / Timing | Used For |
|---|---|---|
| `spin` | `1s linear infinite` | Loading spinner (border-top trick). Exactly this. |
| `progress-indeterminate` | `1.1s ease-in-out infinite` | Slides across indeterminate progress bar. |
| `fadeIn` | `0.2s` opacity | Modal overlay. |
| `slideUp` | `0.25s` translateY + scale | Modal card entrance (`20px` offset, `0.98→1.0` scale). |
| `slideDown` | `0.3s` | Update banner appearance. |

### Forbidden Animation — No Exceptions

- Pulsing glow on anything in "running" or "active" state
- Bounce, elastic, or spring easing (cubic-bezier values outside 0–1)
- `transform: scale()` on hover for any button or card (modal entrance `0.98→1.0` is the sole exception)
- Shimmer/skeleton loading animations
- Staggered entrance animations on list items
- Confetti, celebration, or particle effects
- Any `animation` property on an element that does not require looping feedback

### Website Scroll Reveal (Website-Only, Allowed Exception)

The landing page uses a scroll-triggered opacity + translate reveal for feature sections:

```css
.reveal { opacity: 0; transition: opacity 0.75s cubic-bezier(0.16,1,0.3,1), transform 0.75s ...; }
.reveal.from-left  { transform: translateX(-40px); }
.reveal.from-right { transform: translateX(40px); }
.reveal.from-below { transform: translateY(28px); }
.reveal.visible    { opacity: 1; transform: none; }
```

This is triggered by an `IntersectionObserver` and respects `prefers-reduced-motion: reduce`. This is a website-only marketing pattern — it does not apply to the desktop app.

---

## 15. Website — Landing Page Design

### Page Structure (Top to Bottom)

1. **Navbar** — Fixed, 64px, `rgba(9,9,11,0.82)` background with `backdrop-filter: blur(18px) saturate(140%)`, 1px `--border` bottom edge. Logo + download button.
2. **Hero** — Full-height section with background image overlay (darkened), two-column grid: text left, tilted screenshot right. Large headline, download button, meta pills with check marks and version chip.
3. **Feature Section 1** (Mods) — Screenshot left (tilt-left), text right. Section label (mono, accent), feature heading, description, chip pills.
4. **Stat Strip** — 4 stat blocks in a row with mono labels and bold values. Bordered dividers between blocks.
5. **Feature Section 2** (Profiles) — Text left, screenshot right (tilt-right). Same structure as Feature 1.
6. **CTA Section** — Centered, max 520px, heading + description + large download button.
7. **Footer** — 1px top border, flex row: logo, copyright, legal links.

### Screenshot Frames

```css
.screenshot-frame, .hero-screenshot {
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.10);
  /* Multi-layered black box-shadow for depth */
  /* Inset 0 1px 0 rgba(255,255,255,0.05) for top-edge brightening */
}
```

Hero screenshot: `perspective(1800px) rotateX(1.8deg) rotateY(-8deg)` — subtle 3D tilt.
Feature screenshots: `perspective(1500px) rotateX(1.3deg) rotateY(±6deg)` — lighter tilt.
Tilts are removed on mobile (≤1040px).

### Version Chip

```html
<span class="version-chip">v1.2.3</span>
```
```css
.version-chip {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
  background: var(--accent-muted);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
}
```
Dynamically populated via GitHub Releases API call in page script.

---

## 16. Website — Legal Pages Design

The legal pages (`impressum.html`, `datenschutz.html`) share the identical header and footer with the landing page. Only the content area differs.

### Legal Page Content Structure

```css
.legal-page { padding: 120px 48px 80px; }
.legal-inner { max-width: 720px; margin: 0 auto; }
```

### Heading Hierarchy

- `h1`: `clamp(2rem, 3vw, 2.9rem)`, `font-weight: 600`, `letter-spacing: -0.03em`, `margin-bottom: 40px`
- `h2`: `14px`, `font-weight: 600`, `color: var(--text)`, `margin-bottom: 12px`, `margin-top: 44px`. Preceded by a section divider (`1px solid var(--border)`, `margin-bottom: 24px`) via `h2::before`. First `h2` skips the divider.
- `h3`: `13px`, `font-weight: 600`, `margin-top: 32px`, `margin-bottom: 10px`
- `p`: `14px`, `color: var(--text-sec)`, `line-height: 1.7`, `margin-bottom: 14px`

### Lists

```css
.legal-inner ul li {
  padding-left: 16px;
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--text-sec);
  line-height: 1.6;
}
.legal-inner ul li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 9px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--accent);
}
```

Table of contents links (`.index-link`): `13px`, `--text-sec`, hover → `--accent`.

### Links

```css
.legal-inner a {
  color: var(--accent);
  transition: color var(--transition-fast);
}
.legal-inner a:hover { color: var(--accent-hover); }
```

---

## 17. App — Layout & Shell

### `index.html` (Electron Entry Point)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>JojoClient</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### Window Chrome

The app uses a **frameless window** (`frame: false`). Custom window controls (minimize, maximize, close) are rendered as a `window-controls` area in the top-right corner. The `--navbar-height` of `48px` is the drag region height.

### Top Navigation Bar (`.top-navbar`)

- Height: `48px`
- Background: `var(--bg-surface)`
- Border-bottom: `1px solid var(--border-color)`
- Drag region layout: brand left, tabs center/right, window controls far right
- `-webkit-app-region: drag` on the navbar

### Navbar Brand (`.navbar-brand`)

```css
display: flex;
align-items: center;
gap: 10px;
font-size: 16px;
font-weight: 700;
color: var(--text-primary);
letter-spacing: -0.02em;
```
Contains inline SVG logo (22×22px) + "JojoClient" text.

### Navbar Tabs (`.navbar-tabs`)

```css
display: flex;
gap: 0;
flex: 1;
background: transparent;
```

Each tab (`.navbar-tab`):
- Height: 100% (fills navbar)
- Padding: `0 16px`
- Icon + label, `gap: 7px`
- Default: `color: var(--text-muted)`, `font-weight: 500`
- Active: `color: var(--text-primary)`, `font-weight: 600`, plus `::after` accent underline

---

## 18. App — Setup & Loading Screens

### Loading Screen (`.loading-screen`)

Initial load state before anything renders:
```css
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
height: 100vh;
background: var(--bg-base);
```
Uses a CSS border-top spinner (`::before` pseudo-element) + text label in `--text-muted` color.

### Setup Screen (`.setup-screen`)

Shown when no base folder is configured:
```css
display: flex;
align-items: center;
justify-content: center;
min-height: 100vh;
background: var(--bg-base);
```

Setup card (`.setup-card`):
- Background: `var(--bg-card)`
- Border: `1px solid var(--border-color)`
- Border-radius: `var(--radius-lg)`
- `box-shadow: var(--shadow-md)`
- `padding: 40px 36px`, `max-width: 400px`, `text-align: center`
- Contains: logo SVG (64px), heading, description, action button

---

## 19. App — Play Screen

### Two-Column Layout

```css
display: grid;
grid-template-columns: var(--sidebar-width) 1fr;
height: calc(100vh - var(--navbar-height));
```

### Left Sidebar

- Background: `var(--bg-surface)`
- Border-right: `1px solid var(--border-color)`
- Contains: installation list, profile selector, version info

### Right Content Area

- `1fr` fills remaining space
- Play button centered
- Game output / log panel below

---

## 20. The Forbidden List (Anti-AI Checklist)

Before finalizing any design change, verify none of these are present:

- [ ] **Gradient** on any button, card, or background → Remove. Use flat fill.
- [ ] **Colored `box-shadow`** (non-black rgba) → Remove. Shadows = black depth only.
- [ ] **`transform: translateY(-Npx)` on hover** → Remove. Hover = color change only.
- [ ] **`transform: scale(1.0N)` on hover** → Remove.
- [ ] **`border-radius` ≥ 12px on non-circular element** → Use `--radius-xl` max.
- [ ] **Second accent color** → There is one accent. Reject all others.
- [ ] **Animation on a stable/running state** → Static color is enough.
- [ ] **`letter-spacing` ≥ 0.08em on non-uppercase text** → Wide tracking = uppercase labels only.
- [ ] **`border: 2px solid` on interactive element** → All borders are 1px.
- [ ] **Multiple accent colors on a grid of cards** → One accent, everything else zinc.
- [ ] **Emoji in any label, button, or heading** → Forbidden. SVG icons only.
- [ ] **`background: linear-gradient(...)` anywhere** → Not present, must not be introduced.
- [ ] **Inline literal color** (`style={{ color: '#22C55E' }}`, `background: #18181B`) → Use CSS tokens.
- [ ] **Filled/solid icon among stroke icons** → Match the stroke style.
- [ ] **Modal wider than `600px`** → Keep modals constrained.
- [ ] **Font weight 300, 800, or 900** → Use existing {400, 500, 600, 700} scale.
- [ ] **Glass/card blur** (`backdrop-filter: blur(20px)`) → Only allowed on modal overlay and website navbar. Not on cards.
- [ ] **New background surface layer** → Six is the limit. Use the closest existing layer.
- [ ] **Centered emoji-or-icon empty state with friendly sentence and CTA pill** → Quiet text + secondary button.
- [ ] **Decorative `<hr>` or `border-top: 2px solid` between every section** → Use spacing for separation.

---

## 21. Implementation Rules

### Token Discipline

**Always use tokens. Never use literals.**

- ✅ `background: var(--bg-card);`
- ❌ `background: #1C1C1F;`

This is non-negotiable. Light theme adapts through token indirection; a literal color breaks it.

### Code Organization

- All CSS lives in `src/App.css` (app) or inline `<style>` in each `.html` file (website).
- Design tokens in `:root` blocks only.
- App icons are defined as bare SVG functions at the top of `src/App.tsx` — no icon font, no external library.

### Pre-Commit Type Check

After any change:
```
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.electron.json --noEmit
```

---

## 22. File Map

| File | Role |
|---|---|
| `DESIGN.md` | **This file.** The authoritative design reference. |
| `src/App.css` | All Electron app styles. `:root` tokens, components, layout, themes. |
| `src/App.tsx` | Main React component. Inline SVG icon definitions at top. |
| `src/components/icons.tsx` | Shared icon components (React). |
| `src/index.css` | Minimal base styles for Electron entry point. |
| `index.html` | Electron app entry HTML. Favicon reference. |
| `jojoclient.html` | Landing page source. Full website design system. |
| `impressum.html` | Legal page — Impressum (source). |
| `datenschutz.html` | Legal page — Datenschutzerklärung (source). |
| `docs/index.html` | Landing page (GitHub Pages deployed copy). |
| `docs/impressum.html` | Legal page — Impressum (deployed). |
| `docs/datenschutz.html` | Legal page — Datenschutzerklärung (deployed). |
| `docs/icon.svg` | Website favicon (deployed). |
| `public/icon.svg` | App icon SVG (280×280 square). |
| `icon.svg` | Website favicon (root, for local dev). |
| `jojoclient_logo_voxel_cube.svg` | Full logo source file (680×360 viewBox). |
| `electron-builder.json5` | Build config — `icon` field, `productName`, `appId`. |
| `electron/main.ts` | `BrowserWindow` `icon` path. |
| `public/screenshots/` | Website screenshot images. |
| `public/backgrounds/` | Website hero background image. |
| `CLAUDE.md` | Development rules & architecture (complementary). |
| `.kilo/skills/frontend-design/SKILL.md` | Mandatory procedure for UI edits (complementary). |
