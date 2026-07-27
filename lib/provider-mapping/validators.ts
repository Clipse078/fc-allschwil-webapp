/**
 * lib/provider-mapping/validators.ts
 *
 * Runtime validation helpers for provider mapping input fields.
 *
 * TEXT columns (mappingSource, confidenceLevel) must be validated at the API
 * layer to prevent arbitrary strings from being persisted. TypeScript types
 * narrow at compile time but JSON deserialization is unchecked at runtime.
 */

import type { ConfidenceLevel } from "./types";

// ── Allowed values ─────────────────────────────────────────────────────────────

const VALID_CONFIDENCE_LEVELS: ReadonlySet<string> = new Set(["HIGH", "MEDIUM", "LOW"]);

// ── Validators ─────────────────────────────────────────────────────────────────

/**
 * Returns the value as ConfidenceLevel when it is a valid confidence level string,
 * or undefined when the value is undefined/null/invalid.
 *
 * @throws never — returns undefined for invalid values; callers decide whether
 *   to reject or silently drop the field.
 */
export function parseConfidenceLevel(value: unknown): ConfidenceLevel | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "string") return undefined;
  if (VALID_CONFIDENCE_LEVELS.has(value)) return value as ConfidenceLevel;
  return undefined;
}

/**
 * Returns true when the value is a valid ConfidenceLevel string.
 */
export function isValidConfidenceLevel(value: unknown): value is ConfidenceLevel {
  return typeof value === "string" && VALID_CONFIDENCE_LEVELS.has(value);
}
