/** Desktop sidebar width preference — persisted in localStorage only. */

export const SIDEBAR_WIDTH_STORAGE_KEY = "sce-sidebar-width";

export const SIDEBAR_WIDTH_MIN = 180;
export const SIDEBAR_WIDTH_MAX = 320;
export const SIDEBAR_WIDTH_DEFAULT = 224;

export function clampSidebarWidth(width: number): number {
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, width));
}

export function readStoredSidebarWidth(): number {
  if (typeof window === "undefined") return SIDEBAR_WIDTH_DEFAULT;
  const stored = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
  if (!stored) return SIDEBAR_WIDTH_DEFAULT;
  const parsed = Number.parseInt(stored, 10);
  if (Number.isNaN(parsed)) return SIDEBAR_WIDTH_DEFAULT;
  return clampSidebarWidth(parsed);
}

export function persistSidebarWidth(width: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(clampSidebarWidth(width)));
}
