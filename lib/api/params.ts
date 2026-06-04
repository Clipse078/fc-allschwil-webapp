/**
 * lib/api/params.ts
 *
 * Shared query-parameter parsing utilities for API route handlers.
 * No server-only or Prisma imports — safe to use in any route context.
 */

/**
 * Parses a query parameter as a non-negative integer.
 * Returns `def` if the value is absent, non-numeric, or negative.
 * Clamps the result to [0, max].
 */
export function parseIntParam(
  value: string | null,
  def: number,
  max: number,
): number {
  if (!value) return def;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return def;
  return Math.min(n, max);
}
