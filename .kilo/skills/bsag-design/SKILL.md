---
name: bsag-design
description: Mandatory frontend design skill for the BSAG Web Application. Provides precise CSS tokens, component patterns, and validation rules derived from DESIGN.md. MUST be loaded before any frontend GUI change.
---

# BSAG Frontend Design Skill

> **Status:** MANDATORY — load this skill before ANY frontend change (component creation, styling, layout, CSS, HTML structure).

This skill translates [`DESIGN.md`](../../DESIGN.md) into executable frontend rules. It is the single source of truth for all visual implementation. Every rule here is grounded in extracted token evidence from the BSAG website.

---

## 1. CSS Custom Properties (Design Tokens)

These MUST be defined in your CSS root (`:root`). Never use raw hex values or px values in components — always reference the CSS variable.

### 1.1 Colors

```css
:root {
  /* === COLOR TOKENS (19 total, from DESIGN.md) === */

  /* Core surfaces */
  --color-white: #ffffff;
  --color-off-white-surface: #f9fafb;
  --color-pale-surface: #dbe3e6;
  --color-near-black: #24242a;

  /* Text colors */
  --color-dark-teal: #31464f;       /* PRIMARY TEXT — highest frequency (529 hits) */
  --color-medium-gray: #545459;     /* Secondary/muted text, icon fills */
  --color-near-black-text: #24242a; /* Secondary text, button labels, strong UI */

  /* Interactive / borders */
  --color-light-blue-gray: #b7c7cd; /* Input borders, dividers, button outlines */

  /* Brand & accent */
  --color-transit-red: #e30613;     /* PRIMARY CTA — brand logo, hero pill, main button */
  --color-transit-green: #009640;   /* SECONDARY CTA — 'Verbindung finden', transit line */
  --color-transit-blue: #009fe3;    /* Transit line, informational accent */
  --color-transit-orange: #ef7d00;  /* Transit line, map accent */
  --color-transit-purple: #312783;  /* Transit line (purple line) */
  --color-transit-yellow: #ffcc00;  /* Transit line, map accent */
  --color-lime-green: #95c11f;      /* Transit line, map accent */
}
```

### 1.2 Semantic Color Roles

Always reference colors through their **role**, not their raw token name:

| CSS Variable | Role | Usage |
|---|---|---|
| `--color-text-primary` | text | Primary body text, navigation, card content |
| `--color-text-secondary` | text | Muted descriptions, secondary labels |
| `--color-text-strong` | text | Button labels, emphasized UI text |
| `--color-text-muted` | text | Icon fills, captions |
| `--color-surface-page` | background | Page background |
| `--color-surface-card` | background | Card backgrounds, input fields |
| `--color-surface-header` | background | Header/hero background |
| `--color-surface-label` | background | Form label backgrounds |
| `--color-border-default` | border | Input borders, dividers, outlines |
| `--color-action-primary` | CTA | The single most important action per screen |
| `--color-action-secondary` | CTA | Secondary action (e.g. "Verbindung finden") |
| `--color-accent-info` | accent | Informational accent (transit line blue) |
| `--color-accent-lines` | accent | Transit line colors (orange, purple, yellow, lime) |

```css
:root {
  /* Semantic roles — LIGHT THEME (default) */
  --color-text-primary: var(--color-dark-teal);
  --color-text-secondary: var(--color-medium-gray);
  --color-text-strong: var(--color-near-black);
  --color-text-muted: var(--color-medium-gray);

  --color-surface-page: var(--color-white);
  --color-surface-card: var(--color-white);
  --color-surface-header: var(--color-off-white-surface);
  --color-surface-label: var(--color-pale-surface);

  --color-border-default: var(--color-light-blue-gray);

  --color-action-primary: var(--color-transit-red);
  --color-action-secondary: var(--color-transit-green);
  --color-accent-info: var(--color-transit-blue);
}
```

### 1.3 Spacing

```css
:root {
  /* Spacing scale — 8px base grid, 16 tokens */
  --space-1: 4.8px;
  --space-2: 8px;
  --space-3: 9.6px;
  --space-4: 11.2px;
  --space-5: 12px;
  --space-6: 12.8px;
  --space-7: 14px;
  --space-8: 16px;
  --space-9: 18px;
  --space-10: 19.2px;
  --space-11: 20px;
  --space-12: 24px;
  --space-13: 28px;
  --space-14: 40px;
  --space-15: 64px;
  --space-16: 83.2px;
}
```

### 1.4 Radius

```css
:root {
  --radius-xs: 2.4px;   /* Subtle corner (small elements) */
  --radius-sm: 3.2px;   /* Subtle corner (slightly larger) */
  --radius-md: 8px;     /* Control corner (buttons, inputs, cards) */
  --radius-pill: 40px;  /* Large surface corner (pills, tags, CTAs) */
}
```

### 1.5 Shadows

```css
:root {
  /* ONLY these two shadows are evidenced. Do NOT invent more. */
  --shadow-card: 0px 0px 12px 0px rgba(0, 0, 0, 0.05);
  --shadow-subtle: 0px 0px 10px 0px rgba(0, 0, 0, 0.1);
}
```

---

## 2. Typography System

**MetaWeb is the ONLY allowed typeface.** No fallbacks beyond `sans-serif`. Every text element MUST use one of the 10 defined type classes below.

### 2.1 Font Import

```css
@font-face {
  font-family: 'MetaWeb';
  src: url('/fonts/MetaWeb-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'MetaWeb';
  src: url('/fonts/MetaWeb-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
```

### 2.2 Type Scale Classes

Map EXACTLY 1:1 from the DESIGN.md type scale evidence table. Do NOT create intermediate sizes.

| Class | Size | Weight | Line Height | Usage (from DESIGN.md evidence) |
|---|---|---|---|---|
| `.text-body-default` | 18.08px | 400 | 27.12px | Primary body text, navigation, card content *(196 hits)* |
| `.text-label-bold` | 15.2px | 700 | normal | Navigation labels, button text, form labels *(128 hits)* |
| `.text-body-small` | 17.176px | 400 | 25.764px | Secondary body text, descriptions *(32 hits)* |
| `.text-caption` | 14px | 400 | 21px | Small labels, captions, metadata *(29 hits)* |
| `.text-body-medium` | 16px | 400 | 24px | Input field text, secondary body *(21 hits)* |
| `.text-label-small-bold` | 13.56px | 700 | 20.34px | Small bold labels, tags, badges *(20 hits)* |
| `.text-body-large` | 20px | 400 | 30px | Larger body text, intro paragraphs *(16 hits)* |
| `.text-heading-medium` | 24px | 700 | 30px | Section headings, card titles *(12 hits)* |
| `.text-heading-large` | 24px | 700 | 36px | Page section headings *(8 hits)* |
| `.text-display` | 25.312px | 700 | 35.4368px | Hero display text, large callouts *(4 hits)* |

```css
.text-body-default   { font-family: 'MetaWeb', sans-serif; font-size: 18.08px; font-weight: 400; line-height: 27.12px; }
.text-label-bold     { font-family: 'MetaWeb', sans-serif; font-size: 15.2px;  font-weight: 700; line-height: normal; }
.text-body-small     { font-family: 'MetaWeb', sans-serif; font-size: 17.176px;font-weight: 400; line-height: 25.764px; }
.text-caption        { font-family: 'MetaWeb', sans-serif; font-size: 14px;    font-weight: 400; line-height: 21px; }
.text-body-medium    { font-family: 'MetaWeb', sans-serif; font-size: 16px;    font-weight: 400; line-height: 24px; }
.text-label-sm-bold  { font-family: 'MetaWeb', sans-serif; font-size: 13.56px; font-weight: 700; line-height: 20.34px; }
.text-body-large     { font-family: 'MetaWeb', sans-serif; font-size: 20px;    font-weight: 400; line-height: 30px; }
.text-heading-medium { font-family: 'MetaWeb', sans-serif; font-size: 24px;    font-weight: 700; line-height: 30px; }
.text-heading-large  { font-family: 'MetaWeb', sans-serif; font-size: 24px;    font-weight: 700; line-height: 36px; }
.text-display        { font-family: 'MetaWeb', sans-serif; font-size: 25.312px;font-weight: 700; line-height: 35.4368px; }
```

### 2.3 Text Color Assignments

| Text context | Text Class | Text Color |
|---|---|---|
| Body text, navigation, card content | `text-body-default` | `var(--color-text-primary)` |
| Muted descriptions, metadata | `text-body-small`, `text-caption` | `var(--color-text-secondary)` |
| Button labels, emphasized text | `text-label-bold` | `var(--color-text-strong)` |
| Headings | `text-heading-medium`, `text-heading-large`, `text-display` | `var(--color-text-strong)` |
| Input placeholders | `text-body-medium` | `var(--color-text-muted)` |

---

## 3. Spacing Rules

### 3.1 Spacing Token Usage Guide

| Spacing Token | Use For |
|---|---|
| `--space-2` (8px) | Default gap between inline elements, icon padding |
| `--space-8` (16px) | Standard section padding, card padding |
| `--space-12` (24px) | Section margins, component spacing |
| `--space-14` (40px) | Large section gaps, hero padding |
| `--space-15` (64px) | Page-level spacing, major layout separators |
| `--space-16` (83.2px) | Maximum spacing, wide layout gutters |

### 3.2 Spacing Rules

1. **Never use arbitrary px values** — always reference a `--space-N` token.
2. **Gap/padding/margin pairs must be from adjacent scale steps** (e.g., `--space-8` + `--space-12`, not `--space-2` + `--space-16`).
3. **The 8px base grid is authoritative** — test alignment at 8px increments.

---

## 4. Border Radius Rules

| Component | Radius Token |
|---|---|
| Buttons (standard) | `--radius-md` (8px) |
| Primary CTA / Hero pill | `--radius-pill` (40px) |
| Cards | `--radius-md` (8px) |
| Input fields | `--radius-sm` (3.2px) |
| Tags / Badges | `--radius-xs` (2.4px) |
| Modals / Dialogs | `--radius-md` (8px) |

**CRITICAL:** Never mix sharp corners (0px) with rounded corners in the same view. If one element is rounded, all others on that screen must use a radius token.

---

## 5. Shadows

Only these two shadows exist. Assign them strictly:

| Component | Shadow Token |
|---|---|
| Cards | `--shadow-card` |
| Dropdowns, tooltips, modals | `--shadow-subtle` |
| Everything else | NO shadow |

Do NOT invent elevation: no `z-index` stacking beyond what these shadows imply.

---

## 6. Interaction Rules

### 6.1 Focus Outlines

From DESIGN.md Interaction Signals evidence:

```css
*:focus-visible {
  outline-color: var(--color-dark-teal);  /* or white, or near-black — match context */
  outline-width: 3px;
  outline-offset: 0px;
  outline-style: solid;
}
```

Do NOT change outline-width from 3px. Do NOT add outline-offset.

### 6.2 Hover / Active / Pressed

The only evidenced transformations:
- **scale(0.8)** — pressed/active state for interactive elements
- **translateX(1280px)** — slide animation (horizontal scroll indicator)

```css
.btn:active,
.interactive:active {
  transform: scale(0.8);
}
```

Do NOT invent hover colors, transitions, or animations beyond these two transforms unless you first add the evidence to DESIGN.md.

---

## 7. Responsive Breakpoints

From DESIGN.md — use EXACTLY these breakpoints:

```css
/* Mobile-first base styles (280px–767px) */

/* Tablet (≥768px) */
@media (min-width: 768px) { }

/* Desktop (≥1024px) */
@media (min-width: 1024px) { }

/* Large Desktop (≥1280px) */
@media (min-width: 1280px) { }

/* Wide (≥1500px) */
@media (min-width: 1500px) { }

/* Extra Wide (≥1648px) */
@media (min-width: 1648px) { }
```

### 7.1 Responsive Strategy (per DESIGN.md)

| Breakpoint | Strategy |
|---|---|
| mobile (280–1024) | Vertical stacking, constrained layout |
| tablet (≥768) | Increase spacing, introduce columns |
| desktop (≥1024) | Horizontal composition, density |
| wide (≥1500) | Generous gutters, wide layout spans |

### 7.2 Max-width Breakpoints

These also exist in DESIGN.md evidence:
```css
@media (max-width: 830px) { }
@media (max-width: 1024px) { }
```

---

## 8. Component Patterns

### 8.1 Button

```css
.btn-primary {
  /* The SINGLE most important CTA per screen */
  background-color: var(--color-action-primary);  /* transit-red #e30613 */
  color: var(--color-white);
  font-family: 'MetaWeb', sans-serif;
  font-size: 15.2px;
  font-weight: 700;
  border: none;
  border-radius: var(--radius-md);   /* or --radius-pill for hero CTAs */
  padding: var(--space-2) var(--space-8);  /* vertical | horizontal */
  cursor: pointer;
}

.btn-primary:focus-visible {
  outline: 3px solid var(--color-dark-teal);
  outline-offset: 0;
}

.btn-primary:active {
  transform: scale(0.8);
}

.btn-secondary {
  background-color: var(--color-action-secondary);  /* transit-green #009640 */
  color: var(--color-white);
  /* same typography and radius as primary */
}
```

**Constraint:** Only ONE `.btn-primary` per screen. All other actions use `.btn-secondary` or `.btn-tertiary`.

### 8.2 Card

```css
.card {
  background-color: var(--color-surface-card);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  padding: var(--space-8);
}

.card-title {
  font-family: 'MetaWeb', sans-serif;
  font-size: 24px;
  font-weight: 700;
  line-height: 30px;
  color: var(--color-text-primary);
}
```

### 8.3 Input Field

```css
.input {
  font-family: 'MetaWeb', sans-serif;
  font-size: 16px;
  font-weight: 400;
  line-height: 24px;
  color: var(--color-text-primary);
  background-color: var(--color-surface-card);  /* white */
  border: 1px solid var(--color-border-default);  /* light-blue-gray */
  border-radius: var(--radius-sm);  /* 3.2px */
  padding: var(--space-2) var(--space-4);
}

.input:focus-visible {
  outline: 3px solid var(--color-dark-teal);
  outline-offset: 0;
}

.input::placeholder {
  color: var(--color-text-muted);
}

.input-label {
  font-family: 'MetaWeb', sans-serif;
  font-size: 15.2px;
  font-weight: 700;
  color: var(--color-text-primary);
  background-color: var(--color-surface-label);  /* pale-surface */
}
```

### 8.4 Navigation

```css
.nav-link {
  font-family: 'MetaWeb', sans-serif;
  font-size: 18.08px;
  font-weight: 400;
  line-height: 27.12px;
  color: var(--color-text-primary);
  text-decoration: none;
}

.nav-link-active {
  font-weight: 700;
  color: var(--color-action-primary);
}
```

### 8.5 Tag / Badge

```css
.tag {
  font-family: 'MetaWeb', sans-serif;
  font-size: 13.56px;
  font-weight: 700;
  line-height: 20.34px;
  border-radius: var(--radius-xs);
  padding: var(--space-1) var(--space-6);
}

.tag-red    { background-color: var(--color-transit-red);    color: var(--color-white); }
.tag-green  { background-color: var(--color-transit-green);  color: var(--color-white); }
.tag-blue   { background-color: var(--color-transit-blue);   color: var(--color-white); }
.tag-orange { background-color: var(--color-transit-orange); color: var(--color-white); }
.tag-purple { background-color: var(--color-transit-purple); color: var(--color-white); }
.tag-yellow { background-color: var(--color-transit-yellow); color: var(--color-near-black); }
```

---

## 9. Color — WCAG AA Contrast Enforcement

All text MUST meet WCAG AA (4.5:1 for normal text, 3:1 for large text ≥24px bold or ≥18.66px bold).

### 9.1 Validated Combinations (Pre-Approved)

| Background | Text Color | Ratio | Status |
|---|---|---|---|
| `#ffffff` (white) | `#31464f` (dark-teal) | 8.57:1 | ✅ AAA |
| `#ffffff` (white) | `#545459` (medium-gray) | 5.36:1 | ✅ AA |
| `#ffffff` (white) | `#24242a` (near-black) | 15.3:1 | ✅ AAA |
| `#f9fafb` (off-white) | `#31464f` (dark-teal) | 8.36:1 | ✅ AAA |
| `#e30613` (transit-red) | `#ffffff` (white) | 5.29:1 | ✅ AA |
| `#009640` (transit-green) | `#ffffff` (white) | 3.96:1 | ⚠️ Only for large text |
| `#dbe3e6` (pale-surface) | `#31464f` (dark-teal) | 6.82:1 | ✅ AA |
| `#24242a` (near-black) | `#ffffff` (white) | 15.3:1 | ✅ AAA |

### 9.2 Prohibited Combinations

| Do NOT use |
|---|
| `#009640` (transit-green) text on `#ffffff` — fails 4.5:1 (3.96:1). Only use transit-green as background with white bold text ≥24px. |
| `#b7c7cd` (light-blue-gray) text on `#ffffff` — contrast too low (1.86:1). Use only as border, never as text. |
| `#95c11f` (lime-green) text on `#ffffff` — fails AA (1.79:1). Use only as transit-line accent, never as text. |
| `#ffcc00` (transit-yellow) text on `#ffffff` — fails AA (1.49:1). Use only as transit-line accent, never as text. |

---

## 10. Do's and Don'ts (Actionable)

| # | ✅ DO | ❌ DON'T |
|---|---|---|
| 1 | Reference every color, spacing, and radius via CSS variable | Use raw hex or px values in component code |
| 2 | Use `.text-body-default` (18.08px/400) for body text | Use `font-size: 16px` or `18px` directly |
| 3 | Apply `--radius-md` to all cards and buttons consistently | Mix `border-radius: 0` with rounded elements |
| 4 | Max 2 shadows: `--shadow-card` and `--shadow-subtle` | Add `box-shadow` with custom values |
| 5 | Use only the 19 color tokens | Introduce a new hex value |
| 6 | Exactly ONE primary CTA per screen | Put transit-red on multiple buttons |
| 7 | Use MetaWeb exclusively | Use system fonts, Inter, Roboto, etc. |
| 8 | Focus outlines: 3px solid, 0 offset | Change outline-width or add offset |
| 9 | `transform: scale(0.8)` for pressed state | Add custom hover animations or transitions |
| 10 | Verify WCAG AA before committing | Ship a component without contrast check |
| 11 | Use DESIGN.md spacing tokens for gaps/padding/margin | Use arbitrary px values |
| 12 | Mobile-first: base styles for 280px+, then scale up | Write desktop styles first and override for mobile |

---

## 11. Pre-flight Validation Checklist

Before completing ANY frontend change, the agent MUST verify:

- [ ] All colors come from `var(--color-*)` — no raw hex values.
- [ ] All spacing uses `var(--space-N)` — no raw px values.
- [ ] All border-radius uses `var(--radius-*)` — no raw px values.
- [ ] All text uses a `.text-*` class from the type scale — no ad-hoc `font-size`.
- [ ] All text is MetaWeb — no other font-family anywhere.
- [ ] Only `--shadow-card` or `--shadow-subtle` shadows are present — no custom box-shadows.
- [ ] Focus outlines are 3px solid, 0 offset, using an allowed outline color.
- [ ] Exactly ONE primary CTA color (`var(--color-action-primary)`) per screen.
- [ ] No sharp-corners + rounded-corners on the same view.
- [ ] WCAG AA: all text-on-background combinations pass 4.5:1 (or 3:1 for large ≥24px bold text).
- [ ] Responsive: styles start mobile-first, then scale through the 6 breakpoints.

---

## 12. Dark Theme

If implementing dark theme:

```css
[data-theme="dark"] {
  --color-text-primary: var(--color-dark-teal);    /* Same as light per DESIGN.md */
  --color-text-secondary: var(--color-white);      /* White text on dark surfaces */
  --color-text-strong: var(--color-white);
  --color-surface-page: var(--color-near-black);
  --color-surface-card: var(--color-near-black);
}
```

Dark theme colors per DESIGN.md evidence:
- Text: `#31464f` (dark-teal) and `#ffffff` (white)
- Surfaces: `#24242a` (near-black)
- CTAs: `#009640` (transit-green) and `#e30613` (transit-red)
- Do NOT invent dark-theme-specific colors beyond what DESIGN.md lists.
