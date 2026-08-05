/**
 * lib/registrations/person-match.ts
 *
 * REGISTRATION-01F — Goal 2: automatic person lookup.
 *
 * When a registration is opened, existing Person records are searched by
 * email / phone / first+last name so the coordinator can see at a glance
 * whether this applicant already exists — and never create a duplicate
 * Person silently (Goal 11).
 *
 * Matching is intentionally conservative:
 *   - exact email match  → CONFIRMED (very unlikely to be a coincidence)
 *   - phone or full-name match → POSSIBLE (needs a human to confirm)
 *   - nothing found       → NONE
 *   - registration.personId already set → LINKED (no search needed)
 *
 * Person has no tenantId today (see prisma/schema.prisma) — matching is
 * intentionally global, consistent with every other Person lookup in the
 * codebase (search, picker, …). Not touched/fixed here (out of scope).
 */

import { prisma } from "@/lib/db/prisma";

export type PersonMatchReason = "EMAIL" | "PHONE" | "NAME";

export type PersonMatchStatus = "NONE" | "POSSIBLE" | "CONFIRMED" | "LINKED";

export type PersonMatchCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  reasons: PersonMatchReason[];
};

export type PersonMatchResult = {
  status: PersonMatchStatus;
  /** Best-first. Empty when status is "NONE" or "LINKED". */
  candidates: PersonMatchCandidate[];
};

type MatchInput = {
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
};

/** Strips everything but digits and a leading "+" so "+41 79 123 45 67" ≈ "0791234567". */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^\d+]/g, "");
  // Normalize Swiss "0..." vs "+41..." vs "0041..." to the same tail so a
  // parent's phone submitted differently still matches an existing record.
  const tail = digits.replace(/^(\+41|0041|0)/, "");
  return tail || null;
}

const PERSON_MATCH_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  displayName: true,
  email: true,
  phone: true,
  dateOfBirth: true,
} as const;

type PersonMatchRow = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: Date | null;
};

function scoreCandidate(person: PersonMatchRow, input: MatchInput): PersonMatchReason[] {
  const reasons: PersonMatchReason[] = [];

  if (person.email && person.email.trim().toLowerCase() === input.email.trim().toLowerCase()) {
    reasons.push("EMAIL");
  }

  const normalizedInputPhone = normalizePhone(input.phone);
  const normalizedPersonPhone = normalizePhone(person.phone);
  if (normalizedInputPhone && normalizedPersonPhone && normalizedInputPhone === normalizedPersonPhone) {
    reasons.push("PHONE");
  }

  if (
    person.firstName.trim().toLowerCase() === input.firstName.trim().toLowerCase() &&
    person.lastName.trim().toLowerCase() === input.lastName.trim().toLowerCase()
  ) {
    reasons.push("NAME");
  }

  return reasons;
}

function toCandidate(person: PersonMatchRow, reasons: PersonMatchReason[]): PersonMatchCandidate {
  return {
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    displayName: person.displayName,
    email: person.email,
    phone: person.phone,
    dateOfBirth: person.dateOfBirth ? person.dateOfBirth.toISOString() : null,
    reasons,
  };
}

function resultFromCandidates(candidates: PersonMatchCandidate[]): PersonMatchResult {
  if (candidates.length === 0) {
    return { status: "NONE", candidates: [] };
  }
  const status: PersonMatchStatus = candidates.some((c) => c.reasons.includes("EMAIL"))
    ? "CONFIRMED"
    : "POSSIBLE";
  // Best matches first: EMAIL > PHONE > NAME, more reasons first.
  const rank = (c: PersonMatchCandidate) =>
    (c.reasons.includes("EMAIL") ? 100 : 0) +
    (c.reasons.includes("PHONE") ? 10 : 0) +
    (c.reasons.includes("NAME") ? 1 : 0);
  const sorted = [...candidates].sort((a, b) => rank(b) - rank(a));
  return { status, candidates: sorted.slice(0, 5) };
}

/**
 * Finds existing Person candidates for a single registration's identity
 * fields. Used both by the detail view (Goal 2) and by the "Create Person"
 * safety check (Goal 11).
 */
export async function findPersonMatches(input: MatchInput): Promise<PersonMatchResult> {
  const normalizedPhone = normalizePhone(input.phone);

  const orConditions: Array<Record<string, unknown>> = [
    { email: { equals: input.email, mode: "insensitive" } },
    {
      AND: [
        { firstName: { equals: input.firstName, mode: "insensitive" } },
        { lastName: { equals: input.lastName, mode: "insensitive" } },
      ],
    },
  ];

  if (normalizedPhone) {
    // Phone is stored inconsistently formatted; fetch a broader candidate
    // set by suffix and re-check equality after normalization in memory.
    orConditions.push({ phone: { contains: normalizedPhone.slice(-9) } });
  }

  const persons = await prisma.person.findMany({
    where: { OR: orConditions },
    select: PERSON_MATCH_SELECT,
    take: 25,
  });

  const candidates: PersonMatchCandidate[] = [];
  for (const person of persons) {
    const reasons = scoreCandidate(person, input);
    if (reasons.length > 0) {
      candidates.push(toCandidate(person, reasons));
    }
  }

  return resultFromCandidates(candidates);
}

/**
 * Batched variant for list views (inbox) — one Person query for the whole
 * list instead of N. Registrations already linked to a Person short-circuit
 * to "LINKED" without being searched.
 */
export async function attachPersonMatchSummaries<
  T extends {
    personId: string | null;
    email: string;
    phone: string | null;
    firstName: string;
    lastName: string;
  },
>(registrations: T[]): Promise<(T & { personMatch: PersonMatchResult })[]> {
  const unlinked = registrations.filter((r) => !r.personId);

  if (unlinked.length === 0) {
    return registrations.map((r) => ({
      ...r,
      personMatch: r.personId
        ? ({ status: "LINKED", candidates: [] } as PersonMatchResult)
        : ({ status: "NONE", candidates: [] } as PersonMatchResult),
    }));
  }

  const emails = Array.from(new Set(unlinked.map((r) => r.email.trim().toLowerCase()).filter(Boolean)));
  const namePairs = Array.from(
    new Set(unlinked.map((r) => `${r.firstName.trim().toLowerCase()}|${r.lastName.trim().toLowerCase()}`)),
  ).map((pair) => {
    const [firstName, lastName] = pair.split("|");
    return { firstName, lastName };
  });
  const phoneSuffixes = Array.from(
    new Set(
      unlinked
        .map((r) => normalizePhone(r.phone))
        .filter((p): p is string => !!p)
        .map((p) => p.slice(-9)),
    ),
  );

  const orConditions: Array<Record<string, unknown>> = [];
  if (emails.length > 0) {
    orConditions.push({ email: { in: emails, mode: "insensitive" } });
  }
  for (const pair of namePairs) {
    orConditions.push({
      AND: [
        { firstName: { equals: pair.firstName, mode: "insensitive" } },
        { lastName: { equals: pair.lastName, mode: "insensitive" } },
      ],
    });
  }
  for (const suffix of phoneSuffixes) {
    orConditions.push({ phone: { contains: suffix } });
  }

  const persons = orConditions.length > 0
    ? await prisma.person.findMany({
        where: { OR: orConditions },
        select: PERSON_MATCH_SELECT,
        take: 500,
      })
    : [];

  return registrations.map((r) => {
    if (r.personId) {
      return { ...r, personMatch: { status: "LINKED", candidates: [] } as PersonMatchResult };
    }
    const candidates: PersonMatchCandidate[] = [];
    for (const person of persons) {
      const reasons = scoreCandidate(person, {
        email: r.email,
        phone: r.phone,
        firstName: r.firstName,
        lastName: r.lastName,
      });
      if (reasons.length > 0) {
        candidates.push(toCandidate(person, reasons));
      }
    }
    return { ...r, personMatch: resultFromCandidates(candidates) };
  });
}
