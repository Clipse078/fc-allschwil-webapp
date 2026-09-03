/**
 * SCE-DESIGN-04C — Centralized motion tokens for premium nav iconography.
 */

export const SCE_MOTION_COLORS = {
  copper: "#d4843a",
  copperHover: "#be7232",
} as const;

export const SCE_MOTION_DURATION = {
  /** Tiny feedback — 180–240ms */
  fast: 200,
  /** Internal icon movement — ~280–420ms */
  base: 320,
  /** Complex path/wave sequence — max ~500–600ms */
  slow: 480,
  /** Hover intent delay to avoid accidental triggers */
  hoverDelay: 48,
} as const;

export const SCE_MOTION_EASING = {
  out: "cubic-bezier(0.25, 0.1, 0.25, 1)",
  premium: "cubic-bezier(0.22, 0.61, 0.36, 1)",
} as const;

/** CSS custom property names (also defined in globals.css) */
export const SCE_MOTION_CSS_VARS = {
  durationFast: "--sce-motion-duration-fast",
  duration: "--sce-motion-duration",
  durationSlow: "--sce-motion-duration-slow",
  ease: "--sce-motion-ease",
  copper: "--sce-nav-icon-copper",
  copperHover: "--sce-nav-icon-copper-hover",
} as const;
