/**
 * Website Feed v1 — Response Builder
 *
 * Wraps any data payload in the stable v1 envelope.
 * All public /api/public/v1/website/* routes MUST use this builder to
 * guarantee a consistent envelope shape.
 *
 * The envelope is intentionally minimal and never changes shape.
 * Extend the data payload types in response-types.ts instead.
 */

import type { WebsiteFeedEnvelope } from "./response-types";

export function buildWebsiteResponse<T>(data: T): WebsiteFeedEnvelope<T> {
  return {
    version: "v1",
    generatedAt: new Date().toISOString(),
    data,
  };
}
