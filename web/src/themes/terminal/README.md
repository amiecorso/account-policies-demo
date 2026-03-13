# Theme 2: Cyberpunk Terminal — Agent Authorization

A mission-control terminal aesthetic for the Account Policies demo. Every interaction reads like provisioning an autonomous AI agent on a hardened ops system.

## Design decisions

**True black + matrix green.** The palette is uncompromising: `#000000` background, `#00ff41` primary accent. No grays, no softening. Secondary pink (`#ff006e`) marks limits and danger zones. Cyan (`#00d4ff`) marks live system state.

**Monospace everything.** JetBrains Mono at every font size, tracked uppercase labels, `//`-prefixed section headers. The UI reads like source code annotated by the runtime.

**CRT scanline overlay.** A fixed `repeating-linear-gradient` pseudo-element sits over the entire viewport. The effect is subtle at 5% opacity — visible on a dark monitor, invisible in screenshots. A radial vignette darkens the corners.

**No JavaScript animations except the braille spinner and the clock.** All hover states, glows, blinks, and slide-ins are CSS. The braille spinner (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`) cycles in React state for the executing view.

**ASCII card headers.** `╔══ TITLE ══╗` using Unicode box-drawing characters, not images or SVG.

## Files

| File | Purpose |
|---|---|
| `theme.css` | CSS custom properties, keyframes, utility classes |
| `Layout.tsx` | `TerminalLayout` — full-page shell with header, nav, footer |
| `components.tsx` | Reusable primitive components |
| `preview.tsx` | Self-contained demo cycling through all 4 UI states |

## Components

- `TerminalCard` — surface card with optional ASCII title bar. `glowing` prop adds pulsing green box-shadow.
- `TerminalButton` — `variant: 'primary' | 'destructive' | 'ghost'`. Transparent background by default; glow on hover.
- `TerminalStatusBadge` — blinking `●` dot with color-coded status text.
- `TerminalSectionHeader` — `// SECTION` header with optional line number and trailing gradient rule.
- `TerminalAddressDisplay` — `0xAbCd████...████` — obscures middle bytes visually, keeps first 6 and last 4.
- `TerminalInput` — green focus ring with `caret-color: #00ff41`. Labels prefixed with `//`.
- `TerminalSelect` — styled dropdown matching the input aesthetic.
- `TerminalDataRow` — key: value terminal output row.
- `TerminalDivider` — optional labeled horizontal rule.
- `BrailleSpinner` — animates through `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` at configurable fps.

## Activation

### Use TerminalLayout in a page

```tsx
// app/some-page/page.tsx
import { TerminalLayout } from "@/themes/terminal/Layout";

export default function Page() {
  return (
    <TerminalLayout>
      <YourContent />
    </TerminalLayout>
  );
}
```

### Render the preview standalone

```tsx
// app/theme-preview/page.tsx
import { TerminalPreview } from "@/themes/terminal/preview";

export default function ThemePreviewPage() {
  return <TerminalPreview />;
}
```

### Import individual components

```tsx
import {
  TerminalCard,
  TerminalButton,
  TerminalStatusBadge,
  TerminalSectionHeader,
  TerminalAddressDisplay,
  TerminalInput,
} from "@/themes/terminal/components";
```

The CSS is imported automatically via `import "./theme.css"` at the top of `Layout.tsx` and `components.tsx`. No additional Tailwind config or global CSS changes required — the theme is fully self-contained.

## Tailwind v4 notes

This theme uses **CSS custom properties only** — no Tailwind utility classes for colors or spacing. This keeps it compatible with Tailwind v4's `@import "tailwindcss"` setup without needing `tailwind.config.js` theme extensions. The `.theme-terminal` class sets all custom properties; child components read from them via `var(--term-*)`.
