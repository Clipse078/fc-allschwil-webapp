/**
 * lib/publishing/types.ts — compatibility barrel.
 *
 * Re-exports everything from the two canonical modules so that existing
 * imports of `@/lib/publishing/types` continue to resolve without change.
 *
 * Prefer importing directly from the specific module in new code:
 *   - CMS editorial workflow  → `@/lib/publishing/editorial-types`
 *   - Infoboard event DTOs    → `@/lib/publishing/event-types`
 */

export * from "./editorial-types";
export * from "./event-types";
