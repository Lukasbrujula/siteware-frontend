# Siteware Design System — Style Guide

## Extracted from siteware.io | March 3, 2026 | v1.0

> **Source:** Live crawl of https://www.siteware.io (Elementor kit CSS, inline styles, Google Fonts, chatbot widget)
> **Purpose:** Design tokens and patterns for building SiteFlow dashboard components that match Siteware's brand identity.
> **Note:** This covers the marketing site. The SiteFlow dashboard may have additional internal patterns — update this doc when Andreas provides dashboard-specific assets.

---

## 1. Color Palette

### Brand Colors (from Elementor Kit)

| Token            | Hex       | Role                                                           | Tailwind Mapping       |
| ---------------- | --------- | -------------------------------------------------------------- | ---------------------- |
| `--sw-primary`   | `#000000` | Primary — text, headings, dark backgrounds                     | `gray-950` or `black`  |
| `--sw-secondary` | `#FFFFFF` | Secondary — page background, card surfaces                     | `white`                |
| `--sw-text`      | `#A5A5A5` | Body text / muted content                                      | `gray-400`             |
| `--sw-accent`    | `#CC00FF` | Accent — CTAs, hover states, interactive elements, links:hover | Custom: `brand-accent` |
| `--sw-surface`   | `#F0F0F0` | Surface — light backgrounds, card fills, borders               | `gray-100`             |
| `--sw-warm`      | `#FFBC7D` | Warm accent — page transitions, highlights                     | Custom: `brand-warm`   |

### Dark UI Colors (from Chatbot Widget)

| Token               | Hex         | Usage                                     |
| ------------------- | ----------- | ----------------------------------------- |
| `--sw-overlay`      | `#00000059` | Panel overlay, dimmed backgrounds         |
| `--sw-overlay-dark` | `#00000054` | Send button background, muted interactive |
| `--sw-border-light` | `#FFFFFF99` | Borders on dark backgrounds (60% white)   |
| `--sw-dark-bg`      | `#030710`   | Deep dark background (chatbot/dashboard)  |

### Chatbot Gradient (Loading Animation)

```css
linear-gradient(to bottom right, #4a00e0, #ff0080)
```

This purple-to-pink gradient appears in the chatbot loader SVG. Could be used for loading states in the dashboard.

### Summary: Siteware operates on a **high-contrast dark theme** with:

- **Black** (`#000000`) as the dominant surface
- **White** (`#FFFFFF`) for text and content on dark backgrounds
- **Electric Purple** (`#CC00FF`) as the single accent color
- **Muted Gray** (`#A5A5A5`) for secondary text
- **Light Gray** (`#F0F0F0`) for subtle surface differentiation
- **Warm Orange** (`#FFBC7D`) as a secondary warm accent

---

## 2. Typography

### Font Families

| Role                                    | Font           | Google Fonts                              | Fallback   |
| --------------------------------------- | -------------- | ----------------------------------------- | ---------- |
| **Primary** (headings, body)            | Archivo        | `Archivo:ital,wght@0,100..900;1,100..900` | Sans-serif |
| **Monospace** (labels, tags, technical) | JetBrains Mono | `JetBrains+Mono:wght@300`                 | monospace  |

### Type Scale (Desktop → Tablet → Mobile)

| Level       | Desktop      | Tablet (≤1024px) | Mobile (≤767px) | Weight | Line Height | Notes                                       |
| ----------- | ------------ | ---------------- | --------------- | ------ | ----------- | ------------------------------------------- |
| H1 (hero)   | 8em (128px)  | 3.2em            | 3.2em           | 400    | 0.9em       | Tight leading, display only                 |
| H2          | 3.2em (51px) | 2.4em            | 2.4em           | 400    | 1.05em      | Section headings                            |
| H3          | 2.8em (45px) | —                | 1.8em           | 400    | 1.05em      | Subsection headings                         |
| H4          | 2.6em (42px) | 1.8em            | —               | 400    | 1.05em      | Card/block headings                         |
| H5 (custom) | 2.4em (38px) | —                | —               | 400    | 1.05em      | Sub-headings                                |
| Body Large  | 45px         | 35px             | 35px            | 400    | 1.05em      | Feature descriptions, `-1px` letter-spacing |
| Body        | 22px         | 18px             | 18px            | 400    | 1.35em      | Standard body text                          |
| Body Small  | 18px         | —                | 16px            | 400    | 1.3em       | Captions, secondary info                    |
| Label / Tag | 14px         | —                | —               | 300    | 1em         | JetBrains Mono, uppercase                   |
| Button Text | 18px         | —                | 16px            | 600    | 1.05em      | Archivo, `-0.25px` letter-spacing           |

### Typography Rules

- **JetBrains Mono** is always `weight: 300`, `uppercase`, `line-height: 1em` — used for labels, tags, metadata, technical identifiers
- **Archivo** handles everything else at `weight: 400` (body) or `weight: 600` (buttons, emphasis)
- Headings have **negative letter-spacing** (`-0.5px` to `-1px`) for tighter display feel
- H1 is dramatically oversized (8em) — this is a hero-only style, not for dashboard use
- For dashboard context, H2–H4 range and Body/Body Small are the primary working sizes

---

## 3. Spacing & Layout

### Container

| Property       | Value                                                   |
| -------------- | ------------------------------------------------------- |
| Max width      | `1140px` (desktop), `1024px` (tablet), `767px` (mobile) |
| Widget spacing | `20px` (both row and column)                            |
| Block gap      | `24px`                                                  |
| Content width  | `800px` (text content)                                  |
| Wide width     | `1200px` (full-width sections)                          |

### Spacing Scale (WordPress Preset)

| Token          | Value             | Use Case                      |
| -------------- | ----------------- | ----------------------------- |
| `--spacing-20` | `0.44rem` (~7px)  | Tight internal padding        |
| `--spacing-30` | `0.67rem` (~11px) | Small gaps                    |
| `--spacing-40` | `1rem` (16px)     | Standard padding              |
| `--spacing-50` | `1.5rem` (24px)   | Section padding, card padding |
| `--spacing-60` | `2.25rem` (36px)  | Large section gaps            |
| `--spacing-70` | `3.38rem` (54px)  | Major section separation      |
| `--spacing-80` | `5.06rem` (81px)  | Hero/banner spacing           |

---

## 4. Border Radius

| Context                   | Value                 | Tailwind                                           |
| ------------------------- | --------------------- | -------------------------------------------------- |
| **Pills / Tags / Badges** | `100px`               | `rounded-full`                                     |
| **Cards / Containers**    | `25px`                | `rounded-3xl` (closest) or custom `rounded-[25px]` |
| **Buttons**               | `100px` (pill-shaped) | `rounded-full`                                     |

Siteware uses only two radius values: fully rounded (pills) and a generous 25px for cards. There are no small radii (4px, 8px) in the marketing site.

---

## 5. Shadows

The marketing site uses **no visible box-shadows** (`box-shadow: none !important` is declared). The design relies on:

- **Color contrast** (dark/light sections) for depth
- **Border** (`1px solid #FFFFFF99` on dark backgrounds) for edge definition
- **Background overlays** for layering effects

For the dashboard, consider adding subtle shadows for card elevation since the dashboard will need more visual hierarchy than the marketing site.

---

## 6. Component Patterns

### Buttons

```
Primary CTA:
- Background: #CC00FF (accent)
- Text: #FFFFFF
- Border-radius: 100px (pill)
- Font: Archivo, 18px, weight 600
- Hover: lighten accent or scale(1.05)
- Padding: consistent with 44px min touch target

Ghost / Secondary:
- Background: transparent
- Border: 1px solid #FFFFFF99 (on dark) or #A5A5A5 (on light)
- Text: #FFFFFF (dark bg) or #000000 (light bg)
- Hover: background fills with accent color, text turns white
```

### Cards (Use Case Cards on Marketing Site)

```
- Background: dark (#030710 area) with subtle differentiation
- Border-radius: 25px
- Padding: ~20px internal
- Text hierarchy: JetBrains Mono label (uppercase, 14px) → Archivo heading → Archivo body
- No shadow — depth via background color layering
```

### Navigation

```
- Logo: white SVG on dark background
- Nav links: #A5A5A5 (muted) → #CC00FF on hover
- Font: follows secondary typography (could be JetBrains Mono uppercase for categories)
- Mobile: hamburger with overlay panel
```

### Chatbot Widget (Reference for Dashboard Interactions)

```
- Panel background: #00000059 overlay
- Input: borderless, 16px font size
- Send button: #00000054 bg → #CC00FF on hover
- Close button: scale(1.1) on hover
- Content padding: 20px
- Examples/suggestions: inline-block pills
```

### Pricing Cards

```
- Background: dark with section differentiation
- Price: large Archivo, prominent
- Features: bullet list, standard body text
- CTA: pill button, accent color
- Badge for discount: warm accent (#FFBC7D) or accent purple
```

---

## 7. Tailwind Configuration (Recommended)

```typescript
// tailwind.config.ts — Siteware SiteFlow Dashboard
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class", // Siteware is dark-first
  theme: {
    extend: {
      colors: {
        brand: {
          accent: "#CC00FF",
          "accent-hover": "#D633FF", // lighter variant for hover
          "accent-muted": "#CC00FF33", // 20% opacity for subtle bg
          warm: "#FFBC7D",
        },
        sw: {
          black: "#000000",
          white: "#FFFFFF",
          text: "#A5A5A5",
          surface: "#F0F0F0",
          "dark-bg": "#030710",
          overlay: "rgba(0, 0, 0, 0.35)", // #00000059
          "overlay-dark": "rgba(0, 0, 0, 0.33)", // #00000054
          "border-light": "rgba(255, 255, 255, 0.6)", // #FFFFFF99
        },
      },
      fontFamily: {
        archivo: ["Archivo", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      fontSize: {
        // Dashboard-appropriate scale (not hero sizes)
        display: ["3.2rem", { lineHeight: "1.05", fontWeight: "400" }],
        h2: ["2.4rem", { lineHeight: "1.05", fontWeight: "400" }],
        h3: ["1.8rem", { lineHeight: "1.05", fontWeight: "400" }],
        h4: ["1.5rem", { lineHeight: "1.05", fontWeight: "400" }],
        "body-lg": ["1.125rem", { lineHeight: "1.3", fontWeight: "400" }],
        body: ["1rem", { lineHeight: "1.35", fontWeight: "400" }],
        "body-sm": ["0.875rem", { lineHeight: "1.3", fontWeight: "400" }],
        label: [
          "0.75rem",
          { lineHeight: "1", fontWeight: "300", letterSpacing: "0.05em" },
        ],
        button: [
          "1rem",
          { lineHeight: "1.05", fontWeight: "600", letterSpacing: "-0.015em" },
        ],
      },
      borderRadius: {
        "sw-card": "25px",
        "sw-pill": "100px",
      },
      spacing: {
        "sw-xs": "0.44rem",
        "sw-sm": "0.67rem",
        "sw-md": "1rem",
        "sw-lg": "1.5rem",
        "sw-xl": "2.25rem",
        "sw-2xl": "3.38rem",
      },
      maxWidth: {
        "sw-content": "800px",
        "sw-wide": "1200px",
        "sw-container": "1140px",
      },
    },
  },
  plugins: [],
};

export default config;
```

---

## 8. Dashboard-Specific Adaptations

The marketing site is a **dark-themed, high-contrast showcase**. For the SiteFlow email dashboard, we should adapt:

### What to keep exactly:

- **Color palette** — accent purple, black/white/gray scale, warm orange
- **Font families** — Archivo + JetBrains Mono pairing
- **Border radius** — 25px cards, pill buttons
- **No-shadow aesthetic** — rely on color contrast for depth

### What to adapt for dashboard context:

- **Type scale** — use H2–H4 range, not the hero H1. Body text at 16–18px for data-dense views
- **Spacing** — tighter than marketing site. Dashboard panels need efficient use of space
- **JetBrains Mono usage** — expand to email metadata, timestamps, classification badges, confidence scores
- **Dark/light mode** — marketing site is pure dark. Dashboard should support a light mode option (using `#F0F0F0` surface, `#000000` text, `#CC00FF` accent)
- **Status colors** — extend palette for classification badges:
  - SPAM: `#CF2E2E` (red)
  - AD: `#FFBC7D` (warm/orange)
  - URGENT: `#CC00FF` (accent purple) or `#FF0080` (from gradient)
  - OTHER: `#A5A5A5` (muted gray)
  - Escalation: `#CF2E2E` (red, matching sentiment danger)
  - Success: `#00D084` (green)

### Action Counter (Red Badge)

```
- Background: #CF2E2E (vivid red from WP preset)
- Text: #FFFFFF
- Shape: circular (rounded-full)
- Font: JetBrains Mono, bold
- Size: 20x20px minimum, scales with count
```

---

## 9. Assets & Resources

### Logo

- White SVG: `https://www.siteware.io/wp-content/uploads/2024/11/siteware-logo-white.svg`
- SiteCore icon: `https://www.siteware.io/wp-content/uploads/2025/12/sitecore-s.png`

### Compliance Badges

- DSGVO badge: `https://www.siteware.io/wp-content/uploads/2025/12/dsgvo.svg`
- Made in Germany: `https://www.siteware.io/wp-content/uploads/2025/12/germany.svg`
- Server Security: `https://www.siteware.io/wp-content/uploads/2025/12/security.svg`

### Google Fonts Import

```html
<link
  href="https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,100..900;1,100..900&family=JetBrains+Mono:wght@300&display=swap"
  rel="stylesheet"
/>
```

---

## 10. Open Items (Requires Input from Andreas)

- [ ] **SiteFlow internal component library** — Is there a Figma file or existing React components?
- [ ] **Dashboard color mode** — Pure dark, pure light, or user toggle?
- [ ] **Existing SiteFlow dashboards** — Screenshots of other workflow dashboards for pattern matching
- [ ] **Icon library preference** — Marketing site uses custom SVGs. Dashboard should use a consistent icon set (Lucide recommended for React/Tailwind compatibility)
- [ ] **Notification styling** — SMS/voice escalation alert patterns in the platform

---

_Siteware GmbH — Style Guide v1.0 — Extracted March 3, 2026_
