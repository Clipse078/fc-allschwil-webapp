/**
 * SCE-DESIGN-04 — Standardized motion intents.
 *
 * Motion explains what happens; it does not decorate the page.
 * Each intent maps to a restrained CSS transform pattern.
 */
export type MotionIntent =
  | "hover"
  | "activate"
  | "open"
  | "communicate"
  | "schedule"
  | "publish"
  | "success"
  | "sync"
  | "globe"
  | "group"
  | "lift"
  | "direction"
  | "gear";
