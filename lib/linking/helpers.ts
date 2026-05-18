import type { EntityRef, TargetCrossLinks } from "./types";
import { INITIATIVE_STUBS, MEETING_STUBS } from "./stubs";

/** Type guard for a single EntityRef. */
export function isEntityRef(value: unknown): value is EntityRef {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.slug === "string" &&
    v.slug.length > 0 &&
    typeof v.title === "string" &&
    v.title.length > 0
  );
}

/** Parse raw JSON (from Prisma) into a typed EntityRef array. */
export function parseEntityRefs(raw: unknown): EntityRef[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isEntityRef).map((ref) => ({
    slug: ref.slug,
    title: ref.title,
    url: ref.url ?? undefined,
  }));
}

/**
 * Resolve a full TargetCrossLinks object from the raw DB JSON fields.
 * Populates urls from known route patterns when not stored.
 */
export function resolveTargetCrossLinks(
  linkedInitiativeRefsRaw: unknown,
  linkedMeetingRefsRaw: unknown,
): TargetCrossLinks {
  const initiativeRefs = parseEntityRefs(linkedInitiativeRefsRaw).map((ref) => ({
    ...ref,
    url: ref.url ?? `/vereinsleitung/initiativen/${ref.slug}`,
  }));

  const meetingRefs = parseEntityRefs(linkedMeetingRefsRaw).map((ref) => ({
    ...ref,
    url: ref.url ?? `/vereinsleitung/meetings/${ref.slug}`,
  }));

  return { initiativeRefs, meetingRefs };
}

/**
 * Toggle a ref in an EntityRef array (add if missing, remove if present).
 * Returns a new array — safe for state updates.
 */
export function toggleEntityRef(
  refs: EntityRef[],
  candidate: EntityRef,
): EntityRef[] {
  const idx = refs.findIndex((r) => r.slug === candidate.slug);
  if (idx === -1) {
    return [...refs, { slug: candidate.slug, title: candidate.title }];
  }
  return refs.filter((_, i) => i !== idx);
}

/** Convenience: check whether a slug is currently linked. */
export function isLinked(refs: EntityRef[], slug: string): boolean {
  return refs.some((r) => r.slug === slug);
}

/** Validate a payload from an untrusted API body. */
export function validateLinkPayload(body: unknown): {
  ok: true;
  initiativeRefs: EntityRef[];
  meetingRefs: EntityRef[];
} | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Ungültiger Anfrage-Body." };
  }

  const b = body as Record<string, unknown>;

  const initiativeRefs = parseEntityRefs(b.initiativeRefs ?? []);
  const meetingRefs = parseEntityRefs(b.meetingRefs ?? []);

  // Guard against linking to unknown stubs (phase 1 safety check)
  const knownInitiativeSlugs = new Set(INITIATIVE_STUBS.map((s) => s.slug));
  const knownMeetingSlugs = new Set(MEETING_STUBS.map((s) => s.slug));

  const badInitiative = initiativeRefs.find((r) => !knownInitiativeSlugs.has(r.slug));
  if (badInitiative) {
    return { ok: false, error: `Unbekannte Initiative: ${badInitiative.slug}` };
  }

  const badMeeting = meetingRefs.find((r) => !knownMeetingSlugs.has(r.slug));
  if (badMeeting) {
    return { ok: false, error: `Unbekanntes Meeting: ${badMeeting.slug}` };
  }

  return { ok: true, initiativeRefs, meetingRefs };
}
