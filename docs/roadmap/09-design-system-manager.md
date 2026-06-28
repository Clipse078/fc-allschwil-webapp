# Design System Manager — CMS V3 Strategic Foundation

**Status:** Roadmap (next strategic milestone after CMS V3 Slice 2)

---

## Overview

The Design System Manager allows each tenant to manage global website design rules that flow automatically into all blocks and templates. Blocks and templates inherit these settings by default, with controlled local overrides.

This is the strategic foundation that makes SportClubEvo a true no-code website builder — not just a block editor, but a visual identity management system.

---

## Scope

### Typography

| Token | Description |
|---|---|
| H1 | Main page heading size, weight, line-height |
| H2 | Section heading |
| H3 | Sub-section heading |
| Body text | Default paragraph text |
| Lead text | Larger intro paragraph |
| Small text | Labels, captions, footnotes |

### Buttons

| Token | Applies to |
|---|---|
| Primary button | Main call-to-action |
| Secondary button | Supporting actions |
| Ghost button | Subtle / outline variant |
| Link button | Inline text links |

### Cards

| Token | Description |
|---|---|
| Border radius | Corner rounding for all cards |
| Shadow | Depth level (none / sm / md / lg) |
| Border | Border width and style |
| Padding | Inner spacing |
| Hover behaviour | Scale, shadow, or glow on hover |

### Spacing

| Token | Description |
|---|---|
| Section spacing scale | Spacing between top-level page sections |
| Content spacing scale | Spacing between elements within a section |
| Grid gaps | Column and row gaps in grid layouts |

### Brand

| Token | Description |
|---|---|
| Primary colour | Club primary colour |
| Secondary colour | Supporting brand colour |
| Accent colour | Highlight / CTA colour |
| Gradient presets | Pre-defined brand gradients |

### Visual Style

| Token | Description |
|---|---|
| Icon style | Outlined / filled / duotone |
| Image radius | Rounded corners for images |
| Animation preferences | Subtle / none / rich |
| Default section widths | Narrow / normal / wide |

---

## Architecture Notes

- Design tokens live in a `TenantDesignSystem` DB model (per-tenant, one row).
- The block registry reads design tokens at render time and applies them as CSS custom properties or Tailwind tokens.
- Blocks can declare which tokens they consume; local overrides are possible per-section via `_layout` config.
- The Visual Canvas (CMS V3) will show token application in real time.
- The admin UI provides a dedicated Design System Manager page (`/dashboard/website/design-system`).

---

## Dependencies

- CMS V3 Slice 2 (Inline Editing & Smart Regions) — must be stable first
- Block registry type system — needs `tokenConsumers` field per block definition
- CSS custom properties infrastructure — Tailwind 4 arbitrary properties or a server-generated stylesheet

---

## Implementation Order (when scoped)

1. DB model `TenantDesignSystem` (migration)
2. Design token type system (`lib/cms/design-tokens.ts`)
3. Admin Design System Manager page (`/dashboard/website/design-system`)
4. Token application to `SectionShell` and `SplitContentCardsRenderer`
5. Block-level token override controls in `LayoutConfigPanel`
6. Visual Canvas live preview with token changes
7. Extend to additional block types

---

## Out of Scope (for now)

- Font upload (use Google Fonts or system fonts initially)
- Dark mode tenant variants (single-mode per tenant)
- Per-page design overrides (tenant-wide only in V1)
- Component marketplace
- AI-generated design suggestions
