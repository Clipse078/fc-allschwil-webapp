/**
 * lib/infoboard/screen1-acceptance-preview.ts
 *
 * PREVIEW-ONLY guard for the Screen 1 visual acceptance route.
 *
 * Allowed environments:
 *   - Local development (NODE_ENV === "development")
 *   - Ordinary Vercel Preview deployments
 *
 * Blocked in persistent environments, including the authenticated Acceptance
 * target, so the fixture never becomes a public kiosk feature.
 */

import { getRuntimeEnvironment } from "@/lib/env";

export function isScreen1AcceptancePreviewAllowed(): boolean {
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  return getRuntimeEnvironment().isPreview;
}
