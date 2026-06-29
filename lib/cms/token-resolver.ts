/**
 * lib/cms/token-resolver.ts
 *
 * Token Resolver — merges tenant-level design system overrides with the
 * DEFAULT_DESIGN_SYSTEM and returns a fully-populated DesignSystemTokens object.
 *
 * RENDERING FLOW
 *
 *   Renderer
 *       │
 *       ▼
 *   resolveDesignSystem(tenantOverrides?)
 *       │
 *       ▼
 *   Resolved DesignSystemTokens
 *       │
 *       ▼
 *   Render UI
 *
 * USAGE (in a renderer)
 *
 *   import { resolveDesignSystem } from "@/lib/cms/token-resolver";
 *
 *   const ds = resolveDesignSystem();
 *   // Typography
 *   <h2 className={`${ds.typography.h2} ${themeTokens.text}`}>{headline}</h2>
 *   // Buttons
 *   <a className={`${ds.buttons.primary} ${ds.buttons.rounded}`}>Click</a>
 *   // Cards
 *   <div className={ds.cards.default.container}>
 *     <h4 className={ds.cards.default.title}>{title}</h4>
 *     <p className={ds.cards.default.body}>{body}</p>
 *   </div>
 *
 * TOKEN RESOLUTION ORDER
 *   1. Local _layout override (section-level, managed by resolveLayout())
 *   2. Tenant Design System overrides (passed as tenantOverrides param)
 *   3. DEFAULT_DESIGN_SYSTEM baseline
 *   4. Framework fallback (Tailwind utility defaults)
 *
 * BACKWARD COMPATIBILITY
 *   resolveDesignSystem() with no arguments returns DEFAULT_DESIGN_SYSTEM.
 *   All existing renderers that call this with no args will render identically
 *   to their current state (no visual regressions).
 *
 * FUTURE EXTENSION
 *   When per-tenant design system customisation is added to the database, the
 *   tenantOverrides parameter will be populated from the tenant record.
 *   The resolver signature is forward-compatible — callers need no changes.
 */

import type { DesignSystemTokens } from "@/lib/cms/design-system";
import { DEFAULT_DESIGN_SYSTEM } from "@/lib/cms/design-system";

/**
 * Partial design system overrides.
 * All token categories and individual keys are optional.
 * Missing keys fall back to DEFAULT_DESIGN_SYSTEM values.
 */
export type DesignSystemOverrides = Partial<{
  [K in keyof DesignSystemTokens]: Partial<DesignSystemTokens[K]>;
}>;

/**
 * resolveDesignSystem — returns a fully-populated DesignSystemTokens object.
 *
 * Merges the provided partial overrides with DEFAULT_DESIGN_SYSTEM.
 * Each token category is merged shallowly — individual token keys from
 * DEFAULT_DESIGN_SYSTEM fill in any missing keys from the override.
 *
 * @param tenantOverrides — optional partial overrides (future tenant customisation)
 * @returns DesignSystemTokens — fully-populated, safe to use in any renderer
 */
export function resolveDesignSystem(
  tenantOverrides?: DesignSystemOverrides,
): DesignSystemTokens {
  if (!tenantOverrides) return DEFAULT_DESIGN_SYSTEM;

  return {
    typography: {
      ...DEFAULT_DESIGN_SYSTEM.typography,
      ...tenantOverrides.typography,
    },
    buttons: {
      ...DEFAULT_DESIGN_SYSTEM.buttons,
      ...tenantOverrides.buttons,
    },
    cards: {
      ...DEFAULT_DESIGN_SYSTEM.cards,
      ...tenantOverrides.cards,
    },
    colors: {
      ...DEFAULT_DESIGN_SYSTEM.colors,
      ...tenantOverrides.colors,
    },
    spacing: {
      ...DEFAULT_DESIGN_SYSTEM.spacing,
      ...tenantOverrides.spacing,
    },
    shadows: {
      ...DEFAULT_DESIGN_SYSTEM.shadows,
      ...tenantOverrides.shadows,
    },
    radius: {
      ...DEFAULT_DESIGN_SYSTEM.radius,
      ...tenantOverrides.radius,
    },
    sectionWidths: {
      ...DEFAULT_DESIGN_SYSTEM.sectionWidths,
      ...tenantOverrides.sectionWidths,
    },
  };
}
