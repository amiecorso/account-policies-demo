# Theme 3: Brutalist Clarity — The Policy Brief

## Design Philosophy

This theme treats every Account Policies interaction as a **legal/financial document
negotiation**. Inspired by Swiss International Typographic Style crossed with the bold
physicality of brutalist architecture: thick borders, hard offset shadows, extreme
typographic scale, and zero decorative softness.

The UI is not trying to be friendly — it is trying to be **authoritative**.

---

## Visual Language

| Token | Value | Purpose |
|---|---|---|
| Background | `#f7f4ef` warm cream | Legal document paper |
| Surface | `#ffffff` pure white | Card / form surface |
| Border | `3px solid #0d0d0d` | Uncompromising black rules |
| Blue | `#0057ff` cobalt | Authority / call-to-action |
| Yellow | `#f5c518` chrome | Active indicator ONLY |
| Text | `#0d0d0d` near-black | High-contrast body |
| Muted | `#555555` mid-gray | Labels, captions |
| Red | `#e11d48` | Destructive actions |
| Green | `#166534` | Success / active status |

### Card Shadow

Hard offset, no blur: `4px 4px 0px #0d0d0d`. Simulates the physical depth of
a stamped document without any softness.

### Typography

| Role | Font | Notes |
|---|---|---|
| Display / headings | Bebas Neue | Ultra-bold condensed, ALL CAPS |
| Body / labels | Space Grotesk | Geometric grotesque, workhorse |
| Monospace / addresses | Space Mono | Typewriter authority for on-chain data |

All section labels use `letter-spacing: 0.18–0.20em` and `text-transform: uppercase`.
Display headings use `letter-spacing: 0.04–0.12em`.

### Section Numbers

Large faded watermarks (`opacity: 0.06`) behind section headings using Bebas Neue at
`clamp(80px, 14vw, 160px)`. These establish document hierarchy without competing with
content.

### Stamp Overlays

PROCESSING and EXECUTED stamps rotate `-4deg`, use 4px border with an inner ghost
border at `opacity: 0.35` for a physical rubber-stamp effect. PROCESSING pulses;
EXECUTED uses a spring-bounce entrance animation.

---

## File Structure

```
web/src/themes/brutalist/
├── theme.css        CSS custom properties + utility classes (no Tailwind dependency)
├── Layout.tsx       BrutalistLayout wrapper (header, nav, content shell)
├── components.tsx   All shared components
├── preview.tsx      Self-contained interactive demo
└── README.md        This file
```

---

## Components

### `BrutalistCard`
White card with 3px black border and hard shadow. Optional `stampState` prop
(`'processing' | 'success' | 'none'`) renders an overlay stamp.

```tsx
<BrutalistCard label="SECTION LABEL" title="CARD TITLE" stampState="success" stampTxHash="0x...">
  ...
</BrutalistCard>
```

### `BrutalistButton`
Zero border-radius. Variants: `primary` (cobalt blue), `secondary` (white/black),
`destructive` (red). Supports `fullWidth` and `loading` props. Click depresses by
`translate(2px, 2px)` simulating a physical press.

```tsx
<BrutalistButton variant="primary" fullWidth loading={isPending}>
  INSTALL POLICY — SIGN & SUBMIT
</BrutalistButton>
```

### `BrutalistStatusBadge`
Outlined pill (zero radius) with colored text and dot indicator.

```tsx
<BrutalistStatusBadge status="active" />  // ACTIVE (green)
<BrutalistStatusBadge status="pending" /> // PENDING (blue)
<BrutalistStatusBadge status="error" />   // ERROR (red)
```

### `BrutalistSectionHeader`
Renders the faded section number watermark behind the heading. Use `sectionNumber`
as the display string (`"01"`, `"02"`, etc.).

```tsx
<BrutalistSectionHeader sectionNumber="01" label="Section 1" title="PARTIES" />
```

### `BrutalistAddressDisplay`
Space Mono, underlined. `truncate` prop (default `true`) shows `0xAbCd...1234`.

### `BrutalistAmountDisplay`
Bebas Neue display type for large amounts. Accepts `amount` + `unit`.

```tsx
<BrutalistAmountDisplay amount="5,000" unit="USDC" />
```

### `BrutalistDataRow`
Horizontal key-value pair with thin bottom rule. Used inside cards for
structured data.

### `BrutalistField`
Form field wrapper with label, optional hint, and consistent spacing.

### `BrutalistPolicyItem`
Document-style numbered list item for policies. Renders index as `01.`, `02.`,
etc. with name, limit, executor, status badge, and optional action slot.

---

## Activation

### Option A — Use preview component directly

```tsx
// app/your-page/page.tsx
'use client';
import { BrutalistPreview } from '@/themes/brutalist/preview';
export default function Page() { return <BrutalistPreview />; }
```

### Option B — Use layout + components in your own page

```tsx
import { BrutalistLayout } from '@/themes/brutalist/Layout';
import { BrutalistCard, BrutalistButton } from '@/themes/brutalist/components';

export default function Page() {
  return (
    <BrutalistLayout activeNav="moirai-delegate">
      <BrutalistCard label="My Section" title="POLICY MANAGEMENT">
        <BrutalistButton variant="primary" fullWidth>
          EXECUTE NOW
        </BrutalistButton>
      </BrutalistCard>
    </BrutalistLayout>
  );
}
```

### Option C — CSS class only (drop `theme-brutalist` on any container)

All CSS custom properties live under `.theme-brutalist`. You can scope the theme
to a subtree without wrapping the entire app:

```tsx
<div className="theme-brutalist">
  <div className="brut-card">...</div>
</div>
```

---

## CSS-Only Animations

All animations are declared in `theme.css` as `@keyframes` and applied through
class names. No JavaScript animation libraries are used.

| Class | Effect |
|---|---|
| `.brut-fade-in` | 200ms fade + slide up on mount |
| `.brut-stamp-processing` | 1s pulse scale + opacity |
| `.brut-stamp-success` | Spring-bounce appear from scale 0.8 |
| `.brut-btn:active` | translate(2px, 2px) physical press |

---

## Tailwind v4 Note

This theme uses **zero Tailwind utility classes** in its own files — all styling
is done through `theme.css` custom properties and class names. This makes the
theme portable and avoids `tailwind.config.js` dependencies. The app's global
`@import "tailwindcss"` in `globals.css` still applies to surrounding pages.

---

## Design Decisions

**Why hard shadows?** Soft `box-shadow` suggests approachability. Hard offset
`4px 4px 0px` suggests physicality — like a document sitting on a desk.

**Why no border-radius?** Right angles are decisive. Rounded corners imply
optionality.

**Why Bebas Neue for numbers?** It reads like a financial terminal — Bloomberg,
not Stripe. The condensed letterforms make large section numbers space-efficient.

**Why cream background?** `#f7f4ef` is warm enough to feel like paper but
neutral enough not to distract. Pure white would feel sterile; off-white grounds
the document metaphor.

**Why chrome yellow only for active state?** Restraint. Yellow at full saturation
is attention-grabbing. Used only on the active nav indicator and on-chain active
badges, it becomes a meaningful signal rather than decoration.
