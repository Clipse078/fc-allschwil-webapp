/**
 * app/dev-preview/page.tsx
 *
 * Development-only demo page for testing the Live Preview Canvas
 * without authentication or a real database connection.
 *
 * Tests:
 *   - All 9 block renderer components
 *   - LivePreviewCanvas with viewport controls
 *   - Split-pane layout
 *   - Section selection + highlighting
 *
 * Remove this file before production deployment.
 */

import DevPreviewClient from "./DevPreviewClient";

export default function DevPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    return <div>Not available in production.</div>;
  }
  return <DevPreviewClient />;
}
