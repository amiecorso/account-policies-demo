# Oracle Dark — The Fates Watch

A design theme for the Account Policies demo. It draws on Greek mythology — the Moirai (Fates) who spin, measure, and cut the thread of human destiny — translated into a dark, cryptographic aesthetic.

## Design Choices

**Color palette**

| Role | Value | Reasoning |
|---|---|---|
| Background | `#080810` | Near-black with violet undertone — the void before the oracle speaks |
| Surface | `#0d0d22` | Slightly lighter dark indigo for card surfaces |
| Border | `#2a2a6b` | Muted indigo — visible but unobtrusive |
| Gold accent | `#d4a853` | Burnished gold, not bright yellow — ancient, weighted |
| Violet accent | `#a78bfa` | Pale violet for secondary elements and highlights |
| Text | `#f5f0e8` | Warm cream — parchment-like, not cold white |
| Muted text | `#8b8aad` | Lavender-gray — recedes without disappearing |

**Typography**

- Headings use **Cinzel** (Google Fonts), a typeface based on classical Roman inscriptions. It conveys permanence and authority — appropriate for a system governing transaction policy.
- Body and UI text use **Geist Sans** (already in the app) — clean, modern contrast to Cinzel.
- Addresses and on-chain data use **Geist Mono** for legibility.

**Motifs**

- Starfield via pure CSS `box-shadow` — no images, no canvas. Two layers: distant pale stars + occasional gold/violet accent points.
- The three-thread logo mark (three horizontal rules of decreasing width in gold, violet, muted) represents the three Moirai: Clotho who spins, Lachesis who measures, Atropos who cuts.
- `◆` diamond separators in section headers replace generic horizontal rules with an ornamental, jewelry-like divider.
- Gold glow (`box-shadow` with `rgba(212,168,83,...)`) on buttons and active states — warmth against the cold dark.

**Interaction**

- All transitions are CSS-only (`transition`, `@keyframes`). No animation libraries.
- Loading state uses a CSS-spinning border animation.
- Success state draws a checkmark via `stroke-dashoffset` animation.

## File Structure

```
web/src/themes/oracle/
├── theme.css          CSS custom properties, global classes, keyframes
├── Layout.tsx         OracleLayout — header, nav, starfield wrapper
├── components.tsx     OracleCard, OracleButton, OracleStatusBadge,
│                      OracleSectionHeader, OracleAddressDisplay, utilities
├── preview.tsx        Self-contained preview with mock data and state toggling
└── README.md          This file
```

## Activating the Theme

### Option 1 — Wrap individual pages

Replace the existing `div`-based page structure with `OracleLayout`:

```tsx
// app/moirai-delegate/page.tsx
import { OracleLayout } from '../../themes/oracle/Layout';

export default function MoiraiDelegatePage() {
  return (
    <OracleLayout activePage="moirai">
      {/* existing content */}
    </OracleLayout>
  );
}
```

### Option 2 — View the preview in isolation

Add a route that renders the self-contained preview:

```tsx
// app/oracle-preview/page.tsx
import { OraclePreview } from '../../themes/oracle/preview';

export default function OraclePreviewPage() {
  return <OraclePreview />;
}
```

Then visit `http://localhost:3000/oracle-preview`.

### Option 3 — Full swap

In `app/layout.tsx`, import `theme.css` globally and add the `theme-oracle` class to `<body>`.
Then replace the header in both `page.tsx` and `moirai-delegate/page.tsx` with `OracleLayout`.

## Using Components

```tsx
import {
  OracleCard,
  OracleButton,
  OracleStatusBadge,
  OracleSectionHeader,
  OracleAddressDisplay,
} from '../../themes/oracle/components';
import { OracleLayout } from '../../themes/oracle/Layout';

<OracleLayout activePage="moirai">
  <OracleCard title="My Section">
    <OracleStatusBadge status="active" />
    <OracleAddressDisplay address="0x1234..." label="Contract" />
    <OracleButton variant="primary" onClick={handleClick}>
      Execute
    </OracleButton>
    <OracleButton variant="secondary">Cancel</OracleButton>
    <OracleButton variant="destructive">Uninstall</OracleButton>
  </OracleCard>
</OracleLayout>
```

## Notes

- The theme uses CSS custom properties scoped to `.theme-oracle`, so it does not affect the rest of the app unless `OracleLayout` (which adds that class) is the ancestor.
- The `theme.css` import in `Layout.tsx` is intentional — Next.js deduplicates CSS imports, so importing it in both `Layout.tsx` and `components.tsx` is safe.
- Cinzel is loaded from Google Fonts via `@import` in `theme.css`. It is only fetched when the oracle theme is active.
