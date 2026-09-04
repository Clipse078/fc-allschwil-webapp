/**
 * SCE-DESIGN-04C/04D — Centralized motion tokens for premium nav iconography.
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

/** SCE-DESIGN-04D — Continuous hover loop cadence (active segment + rest beat). */
export const SCE_MOTION_LOOP = {
  /** Short loop — ~1.4–1.8s total cadence */
  durationShort: 1600,
  /** Default loop — ~1.8–2.2s total cadence */
  durationBase: 2000,
  /** Long loop — ~2.4–3.0s total cadence */
  durationLong: 2600,
  /** Child icons — slightly calmer cadence */
  durationChild: 2200,
  /** Hover intent delay before loop starts */
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
  loopDuration: "--sce-nav-loop-duration",
  loopDurationShort: "--sce-nav-loop-duration-short",
  loopDurationLong: "--sce-nav-loop-duration-long",
  loopDurationChild: "--sce-nav-loop-duration-child",
  hoverIntentDelay: "--sce-nav-hover-intent-delay",
} as const;
