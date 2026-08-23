/**
 * lib/infoboard/screen1-acceptance-preview.ts
 *
 * PREVIEW-ONLY guard for the Screen 1 visual acceptance route.
 *
 * Allowed environments:
 *   - Local development (NODE_ENV === "development")
 *   - Vercel Preview deployments (VERCEL_ENV === "preview")
 *
 * Blocked in production so the acceptance fixture never becomes a public
 * kiosk feature.
 */

export function isScreen1AcceptancePreviewAllowed(): boolean {
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  return process.env.VERCEL_ENV === "preview";
}
