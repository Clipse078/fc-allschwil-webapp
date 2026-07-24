/**
 * lib/publishing/presentation/allocation-display-resolver.ts
 *
 * Pure, synchronous, deterministic resolvers for already-selected resource
 * allocations (pitches, dressing rooms, generic resources).
 *
 * This module formats resource labels for display only. It does NOT:
 *   - query allocations or databases;
 *   - assign resources to events;
 *   - infer missing resources;
 *   - choose between competing allocations;
 *   - apply occupancy or scheduling rules.
 *
 * Design constraints:
 *   - No Prisma imports, no DB access, no Next.js, no React.
 *   - No environment variable access, no time access, no logging.
 *   - Null is returned when no meaningful value exists.
 *   - No translated prefixes (Garderobe, Kabine, Platz, Pitch, etc.) are added.
 *   - No placeholders ("-", "Unknown", "TBD", etc.) are generated.
 *   - Inputs are never mutated.
 *
 * Inventory notes — verified schema fields used:
 *   FacilityResource: `code` (String, unique per tenant), `name` (String)
 *   Facility:         `name` (String)
 *   Event allocation: stored as code strings (pitchCode, homeDressingRoomCode,
 *                     awayDressingRoomCode) directly on the Event model.
 *
 * Missing proposed fields (absent from real schema, not invented):
 *   FacilityResource: no `label`, `shortName`, `displayLabel`, or `resourceName`.
 *   The `label` field in AllocationResourceInput is a caller convenience for
 *   pre-resolved labels from static registries (e.g. websiteLabel from pitches.ts);
 *   it is not a database column.
 */

// ── Private normalization helper ───────────────────────────────────────────────

/**
 * Returns the trimmed string if non-blank, or undefined.
 * Treats whitespace-only strings as absent.
 * Preserves internal whitespace and capitalization.
 */
function meaningful(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Returns the first meaningful (non-blank, trimmed) candidate, or null.
 */
function firstMeaningful(
  candidates: ReadonlyArray<string | null | undefined>,
): string | null {
  for (const candidate of candidates) {
    const value = meaningful(candidate);
    if (value !== undefined) return value;
  }
  return null;
}

// ── Generic allocation resource input ─────────────────────────────────────────

/**
 * Structural input for a single allocatable resource.
 *
 * Verified schema fields from FacilityResource:
 *   - `code` → FacilityResource.code (unique per tenant, e.g. "KR2", "G1")
 *   - `name` → FacilityResource.name (human-readable resource name)
 *
 * Caller convenience field (not a database column):
 *   - `label` → a pre-resolved display label supplied by the caller, e.g.
 *               `websiteLabel` from the static pitch registry or `label` from
 *               the dressing-room registry. Optional; callers may omit it.
 *
 * All fields are optional so callers can supply only the fields they have.
 */
export type AllocationResourceInput = {
  readonly label?: string | null;
  readonly code?: string | null;
  readonly name?: string | null;
};

/**
 * Resolves the best display label for a generic allocated resource.
 *
 * Priority:
 *   1. label  (pre-resolved display label, e.g. from static registry)
 *   2. code   (FacilityResource.code — serves as a concise display token)
 *   3. name   (FacilityResource.name — full human-readable name)
 *
 * Blank candidates are skipped. Returns null when nothing meaningful exists.
 * No prefix (Platz, Garderobe, etc.) is added.
 */
export function resolveAllocationLabel(
  input: AllocationResourceInput,
): string | null {
  return firstMeaningful([input.label, input.code, input.name]);
}

// ── Pitch display ──────────────────────────────────────────────────────────────

/**
 * Structural input for pitch display resolution.
 *
 * Extends AllocationResourceInput with facility-level fallback:
 *   - `facilityName` → Facility.name, used only when all resource-level
 *                      candidates are absent.
 */
export type PitchDisplayInput = AllocationResourceInput & {
  readonly facilityName?: string | null;
};

/**
 * Resolves the pitch display label.
 *
 * Resolution order:
 *   1. Resolve a resource-level label via resolveAllocationLabel().
 *   2. When one exists, return it — do not concatenate facility.
 *   3. When all resource-level candidates are absent, use facilityName.
 *   4. Return null when nothing meaningful exists.
 *
 * No pitch prefix is added (Pitch, Platz, Feld, Terrain, etc.).
 *
 * Examples:
 *   { code: "KR2" }                                    → "KR2"
 *   { code: "", name: "Kunstrasen 2" }                 → "Kunstrasen 2"
 *   { facilityName: "Im Brüel" }                       → "Im Brüel"
 *   {}                                                  → null
 */
export function resolvePitchDisplay(input: PitchDisplayInput): string | null {
  const resourceLabel = resolveAllocationLabel(input);
  if (resourceLabel !== null) return resourceLabel;
  return meaningful(input.facilityName) ?? null;
}

// ── Dressing-room display ──────────────────────────────────────────────────────

/**
 * Structural input for dressing-room display resolution.
 *
 * Uses the same field set as AllocationResourceInput (verified against the
 * FacilityResource schema). No narrower structural type is required.
 *
 * The Event model stores dressing-room allocations as raw code strings
 * (homeDressingRoomCode, awayDressingRoomCode). Callers map those codes
 * to this input using the FacilityResource records or static registry.
 */
export type DressingRoomDisplayInput = AllocationResourceInput;

/**
 * Resolves the dressing-room display label.
 *
 * Uses the same candidate resolution as resolveAllocationLabel().
 * No translated prefix is added (Garderobe, Kabine, Dressing Room, etc.).
 * The UI layer may add translated context if needed.
 *
 * Returns null when no meaningful value exists.
 */
export function resolveDressingRoomDisplay(
  input: DressingRoomDisplayInput,
): string | null {
  return resolveAllocationLabel(input);
}

// ── Multiple-allocation display ────────────────────────────────────────────────

/**
 * Options for formatting a list of allocation labels.
 */
export type ResolveAllocationListOptions = {
  /**
   * String placed between resolved labels.
   * Defaults to " · " when not provided.
   * An explicit empty string ("") is valid and collapses labels with no separator.
   * Use nullish coalescing, not `||`, to respect the empty-string case.
   */
  readonly separator?: string;
  /**
   * When true (default), exact duplicate resolved strings are removed.
   * Deduplication is case-sensitive.
   * When false, duplicates are retained in their original order.
   */
  readonly deduplicate?: boolean;
};

/**
 * Resolves and formats a list of allocation resources into a single display string.
 *
 * Rules:
 *   1. Each item is resolved via resolveAllocationLabel().
 *   2. Unresolved (null) items are omitted.
 *   3. Input order is preserved.
 *   4. Default separator is " · ".
 *   5. Default deduplicate is true.
 *   6. Deduplication removes exact normalized (trimmed) strings.
 *   7. Deduplication is case-sensitive ("A" and "a" are distinct).
 *   8. Items are not sorted.
 *   9. Returns null when no meaningful labels remain after filtering.
 *  10. Inputs are not mutated.
 *
 * @example
 *   resolveAllocationList([{ code: "KR2" }, { code: "KR3" }])
 *   // → "KR2 · KR3"
 *
 *   resolveAllocationList([{ code: "A" }, {}, { code: "B" }])
 *   // → "A · B"
 *
 *   resolveAllocationList([{ code: "A" }, { code: "A" }])
 *   // → "A"
 *
 *   resolveAllocationList([{ code: "A" }, { code: "A" }], { deduplicate: false })
 *   // → "A · A"
 *
 *   resolveAllocationList([{ code: "A" }, { code: "B" }], { separator: "" })
 *   // → "AB"
 */
export function resolveAllocationList(
  inputs: readonly AllocationResourceInput[],
  options?: ResolveAllocationListOptions,
): string | null {
  const separator = options?.separator ?? " · ";
  const deduplicate = options?.deduplicate ?? true;

  const resolved: string[] = [];
  const seen = new Set<string>();

  for (const input of inputs) {
    const label = resolveAllocationLabel(input);
    if (label === null) continue;
    if (deduplicate) {
      if (seen.has(label)) continue;
      seen.add(label);
    }
    resolved.push(label);
  }

  if (resolved.length === 0) return null;
  return resolved.join(separator);
}
