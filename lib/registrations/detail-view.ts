/**
 * Registration Detail View — Read Model
 *
 * REGISTRATION-01D — Registration Data Completeness & Detail View UX
 *
 * Normalizes the loosely-typed `payloadJson` blob (see
 * lib/website/integration-contract.ts) into a fully-typed, UI-ready shape
 * covering every field the website integration may send.
 *
 * This module is READ-ONLY:
 *   - It never mutates a registration.
 *   - It never invents data. Fields that were never collected/submitted
 *     resolve to `null`; the UI is responsible for rendering that as
 *     "Nicht angegeben" (see Goal 6 of REGISTRATION-01D).
 *   - It does not change the public API contract, the website payload
 *     shape, or the registration creation flow.
 *
 * Field provenance:
 *   - Typed contract fields (person, address, parentOrGuardian, football,
 *     consent) are read from their documented payloadJson path.
 *   - Some fields requested by club admins (house number, nationality,
 *     playing experience, requested age group, remarks, …) are NOT part of
 *     the typed website contract today. They only reach the database if the
 *     website nests them inside the documented `rawData` catch-all
 *     ("Nothing is discarded" — see integration-contract.ts). This module
 *     looks them up defensively under a few common key spellings.
 *   - Any `rawData` keys that are not explicitly mapped anywhere else are
 *     surfaced verbatim under "Notes from website" (`additionalRawData`) so
 *     that no submitted data is ever silently hidden from operators.
 *
 * REGISTRATION-01E additions (presentation-only, no schema/API change):
 *   - `technical.websiteVersion` — looked up defensively in `rawData`, same
 *     pattern as nationality/remarks above.
 *   - `duplicate` — a read-only projection of the existing
 *     `possibleDuplicate` / `possibleDuplicateOf` payload keys written by
 *     the unchanged duplicate-detection logic in public-submission.ts.
 *   - `formatCompactAddressLines()` — groups the five address fields into
 *     display lines without changing the underlying fields.
 */

export type RegistrationRawShape = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  birthDate: string | null;
  birthYear: number | null;
  message: string | null;
  payloadJson: unknown;
  source: string | null;
  submittedAt: string;
};

export type RegistrationDetailFields = {
  player: {
    firstName: string;
    lastName: string;
    /** Raw gender string as submitted by the website (not normalized). */
    gender: string | null;
    birthDate: string | null;
    birthYear: number | null;
    nationality: string | null;
  };
  address: {
    street: string | null;
    houseNumber: string | null;
    postalCode: string | null;
    city: string | null;
    country: string | null;
  };
  /** True only when at least one address field was actually submitted. */
  hasAnyAddressData: boolean;
  contact: {
    email: string;
    phone: string | null;
  };
  parent: {
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  football: {
    requestedTeam: string | null;
    requestedAgeGroup: string | null;
    preferredTraining: string | null;
    playingExperience: string | null;
    currentClub: string | null;
    previousClub: string | null;
    position: string | null;
  } | null;
  additional: {
    message: string | null;
    remarks: string | null;
    /** Unmapped rawData entries — "Notes from website". Key/value pairs, verbatim. */
    additionalRawData: Array<{ key: string; label: string; value: string }>;
  };
  consents: {
    privacyAccepted: boolean | null;
    marketingConsent: boolean | null;
    photoConsent: boolean | null;
  };
  technical: {
    source: string | null;
    locale: string | null;
    submittedAt: string;
    internalId: string;
    /** Website build/version tag, when the source submitted one via rawData. */
    websiteVersion: string | null;
  };
  /**
   * REGISTRATION-01E — Goal 2: soft duplicate flag as written by the
   * (unchanged) duplicate-detection logic in public-submission.ts. This is a
   * read-only projection of `payloadJson.possibleDuplicate` /
   * `possibleDuplicateOf` — it does not alter duplicate detection itself.
   */
  duplicate: {
    isPossibleDuplicate: boolean;
    /** ID of the earlier registration this one may duplicate, if resolvable. */
    referenceId: string | null;
  };
};

// ── Internal helpers ──────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function pickString(
  source: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function pickBoolean(
  source: Record<string, unknown>,
  keys: string[],
): boolean | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return null;
}

/**
 * Converts a camelCase / snake_case / kebab-case raw key into a readable
 * label, e.g. "howDidYouHear" -> "How Did You Hear". Used only for
 * unmapped rawData entries whose meaning we cannot translate — we show the
 * developer-supplied key rather than guessing at a German label.
 */
function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return spaced
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function stringifyRawValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const joined = value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(", ");
    return joined || null;
  }
  if (isRecord(value)) {
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Keys within `rawData` that are explicitly surfaced elsewhere in the UI
 * (nationality, house number, football extras, remarks, …). Anything else
 * found in `rawData` is treated as an unmapped "note from website".
 */
const MAPPED_RAWDATA_KEYS = new Set([
  "houseNumber",
  "hausnummer",
  "haus_nr",
  "haus_nummer",
  "nationality",
  "nationalitaet",
  "nationalität",
  "staatsangehoerigkeit",
  "staatsangehörigkeit",
  "playingExperience",
  "spielerfahrung",
  "erfahrung",
  "requestedAgeGroup",
  "ageGroup",
  "altersgruppe",
  "jahrgangsgruppe",
  "remarks",
  "bemerkungen",
  "anmerkungen",
  "websiteVersion",
  "siteVersion",
  "webVersion",
]);

// ── Main extraction function ──────────────────────────────────────────────

/**
 * Derives the full, display-ready field set for a single registration.
 * Safe to call with any registration regardless of source (website,
 * manual, legacy pre-website-integration records without payloadJson).
 */
export function getRegistrationDetailFields(
  registration: RegistrationRawShape,
): RegistrationDetailFields {
  const payload = toRecord(registration.payloadJson);
  const person = toRecord(payload.person);
  const address = toRecord(payload.address);
  const parentOrGuardian = isRecord(payload.parentOrGuardian) ? toRecord(payload.parentOrGuardian) : null;
  const football = isRecord(payload.football) ? toRecord(payload.football) : null;
  const consent = toRecord(payload.consent);
  const rawData = toRecord(payload.rawData);

  // ── Player ──────────────────────────────────────────────────────────────
  const genderRaw =
    typeof person.gender === "string" && person.gender.trim()
      ? person.gender.trim()
      : pickString(payload, ["gender", "geschlecht", "sex"]);

  const nationality = pickString(rawData, [
    "nationality",
    "nationalitaet",
    "nationalität",
    "staatsangehoerigkeit",
    "staatsangehörigkeit",
  ]);

  // ── Address ─────────────────────────────────────────────────────────────
  const street = pickString(address, ["street"]);
  const postalCode = pickString(address, ["postalCode"]);
  const city = pickString(address, ["city"]);
  const country = pickString(address, ["country"]);
  const houseNumber = pickString(address, ["houseNumber"]) ?? pickString(rawData, [
    "houseNumber",
    "hausnummer",
    "haus_nr",
    "haus_nummer",
  ]);
  const hasAnyAddressData = !!(street || houseNumber || postalCode || city || country);

  // ── Parent / guardian ───────────────────────────────────────────────────
  let parent: RegistrationDetailFields["parent"] = null;
  if (parentOrGuardian) {
    const firstName = pickString(parentOrGuardian, ["firstName"]);
    const lastName = pickString(parentOrGuardian, ["lastName"]);
    const name = [firstName, lastName].filter(Boolean).join(" ") || null;
    const email = pickString(parentOrGuardian, ["email"]);
    const phone = pickString(parentOrGuardian, ["phone"]);
    if (name || email || phone) {
      parent = { name, email, phone };
    }
  }

  // ── Football ────────────────────────────────────────────────────────────
  let footballFields: RegistrationDetailFields["football"] = null;
  const requestedTeam = football ? pickString(football, ["desiredTeam"]) : null;
  const preferredTraining = football ? pickString(football, ["preferredTrainingDay"]) : null;
  const currentClub = football ? pickString(football, ["currentClub"]) : null;
  const previousClub = football ? pickString(football, ["previousClub"]) : null;
  const position = football ? pickString(football, ["position"]) : null;
  const requestedAgeGroup = pickString(rawData, ["requestedAgeGroup", "ageGroup", "altersgruppe", "jahrgangsgruppe"]);
  const playingExperience = pickString(rawData, ["playingExperience", "spielerfahrung", "erfahrung"]);
  if (
    requestedTeam ||
    requestedAgeGroup ||
    preferredTraining ||
    playingExperience ||
    currentClub ||
    previousClub ||
    position
  ) {
    footballFields = {
      requestedTeam,
      requestedAgeGroup,
      preferredTraining,
      playingExperience,
      currentClub,
      previousClub,
      position,
    };
  }

  // ── Additional information ─────────────────────────────────────────────
  const remarks = pickString(rawData, ["remarks", "bemerkungen", "anmerkungen"]);
  const additionalRawData: RegistrationDetailFields["additional"]["additionalRawData"] = [];
  for (const [key, value] of Object.entries(rawData)) {
    if (MAPPED_RAWDATA_KEYS.has(key)) continue;
    const stringified = stringifyRawValue(value);
    if (!stringified) continue;
    additionalRawData.push({ key, label: humanizeKey(key), value: stringified });
  }

  // ── Consents ────────────────────────────────────────────────────────────
  const privacyAccepted = pickBoolean(consent, ["privacyAccepted"]);
  const marketingConsent = pickBoolean(consent, ["communicationAccepted"]);
  const photoConsent = pickBoolean(consent, ["photoConsent"]);

  // ── Technical ───────────────────────────────────────────────────────────
  const locale = pickString(payload, ["locale"]);
  const websiteVersion = pickString(rawData, ["websiteVersion", "siteVersion", "webVersion"]);

  // ── Duplicate flag (Goal 2) ─────────────────────────────────────────────
  // Written by the unchanged duplicate-detection logic in
  // public-submission.ts as top-level payloadJson keys.
  const isPossibleDuplicate = payload.possibleDuplicate === true;
  const duplicateReferenceId =
    isPossibleDuplicate &&
    typeof payload.possibleDuplicateOf === "string" &&
    payload.possibleDuplicateOf.trim()
      ? payload.possibleDuplicateOf.trim()
      : null;

  return {
    player: {
      firstName: registration.firstName,
      lastName: registration.lastName,
      gender: genderRaw,
      birthDate: registration.birthDate,
      birthYear: registration.birthYear,
      nationality,
    },
    address: { street, houseNumber, postalCode, city, country },
    hasAnyAddressData,
    contact: {
      email: registration.email,
      phone: registration.phone,
    },
    parent,
    football: footballFields,
    additional: {
      message: registration.message,
      remarks,
      additionalRawData,
    },
    consents: { privacyAccepted, marketingConsent, photoConsent },
    technical: {
      source: registration.source,
      locale,
      submittedAt: registration.submittedAt,
      internalId: registration.id,
      websiteVersion,
    },
    duplicate: {
      isPossibleDuplicate,
      referenceId: duplicateReferenceId,
    },
  };
}

// ── Compact address formatting (Goal 3) ────────────────────────────────────

/**
 * Collapses the five address fields into up to three display lines:
 *   1. "Strasse Hausnummer"
 *   2. "PLZ Ort"
 *   3. "Land"
 *
 * Underlying fields are never merged or mutated — this only controls how
 * they are grouped for display. Returns an empty array when nothing was
 * submitted; callers render the "Nicht angegeben" fallback in that case.
 */
export function formatCompactAddressLines(
  address: RegistrationDetailFields["address"],
): string[] {
  const lines: string[] = [];

  const streetLine = [address.street, address.houseNumber].filter(Boolean).join(" ");
  if (streetLine) lines.push(streetLine);

  const cityLine = [address.postalCode, address.city].filter(Boolean).join(" ");
  if (cityLine) lines.push(cityLine);

  if (address.country) lines.push(address.country);

  return lines;
}
