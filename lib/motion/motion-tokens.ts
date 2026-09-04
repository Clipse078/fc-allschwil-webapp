/**
 * SCE-DESIGN-04C/04D/04E — Centralized motion tokens for premium nav iconography.
 */

export const SCE_MOTION_COLORS = {
  copper: "#d4843a",
  copperHover: "#be7232",
} as const;

export const SCE_MOTION_DURATION = {
  /** Tiny feedback — 140–180ms */
  fast: 160,
  /** Internal icon movement — ~200–280ms */
  base: 220,
  /** Complex path/wave sequence — max ~360–420ms */
  slow: 360,
  /** Hover intent delay — near-immediate response */
  hoverDelay: 16,
} as const;

/** SCE-DESIGN-04E — Faster continuous hover loop cadence (active segment + short rest). */
export const SCE_MOTION_LOOP = {
  /** Short loop — ~0.9–1.1s total cadence */
  durationShort: 1000,
  /** Default loop — ~1.1–1.3s total cadence */
  durationBase: 1200,
  /** Long loop — complex mechanical icons up to ~1.4–1.5s */
  durationLong: 1400,
  /** Child icons — ~1.0–1.5s cadence */
  durationChild: 1300,
  /** Copper flow — ~0.8–1.2s energy travel */
  durationCopper: 950,
  /** Hover intent delay before loop starts */
  hoverDelay: 16,
  /** Pointer-leave settle window */
  leaveSettle: 130,
} as const;

export const SCE_MOTION_EASING = {
  /** Fast initial response, smooth deceleration */
  out: "cubic-bezier(0.16, 1, 0.3, 1)",
  /** Premium fluid deceleration for micro-interactions */
  premium: "cubic-bezier(0.33, 1, 0.68, 1)",
  /** Loop cycles — responsive ease-in-out */
  loop: "cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

/** CSS custom property names (also defined in globals.css) */
export const SCE_MOTION_CSS_VARS = {
  durationFast: "--sce-motion-duration-fast",
  duration: "--sce-motion-duration",
  durationSlow: "--sce-motion-duration-slow",
  ease: "--sce-motion-ease",
  easeOut: "--sce-motion-ease-out",
  easeLoop: "--sce-motion-ease-loop",
  copper: "--sce-nav-icon-copper",
  copperHover: "--sce-nav-icon-copper-hover",
  loopDuration: "--sce-nav-loop-duration",
  loopDurationShort: "--sce-nav-loop-duration-short",
  loopDurationLong: "--sce-nav-loop-duration-long",
  loopDurationChild: "--sce-nav-loop-duration-child",
  loopDurationCopper: "--sce-nav-loop-duration-copper",
  hoverIntentDelay: "--sce-nav-hover-intent-delay",
  leaveSettle: "--sce-nav-leave-settle",
} as const;
