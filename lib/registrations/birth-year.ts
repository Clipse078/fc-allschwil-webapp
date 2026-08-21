type RegistrationBirthSource = {
  birthYear: number | null;
  birthDate: string | null;
  payloadJson: unknown;
};

type PlayerBirthFields = {
  birthDate: string | null;
  birthYear: number | null;
};

function parseYearNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const year = Math.trunc(value);
    return year >= 1900 && year <= 2100 ? year : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}$/.test(trimmed)) {
      const year = Number.parseInt(trimmed, 10);
      return Number.isFinite(year) ? year : null;
    }
  }

  return null;
}

export function deriveBirthYearFromDate(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;

  const trimmed = birthDate.trim();
  if (!trimmed) return null;

  const isoDateMatch = trimmed.match(/^(\d{4})-\d{2}-\d{2}/);
  if (isoDateMatch) {
    return parseYearNumber(isoDateMatch[1]!);
  }

  const swissDateMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (swissDateMatch) {
    return parseYearNumber(swissDateMatch[3]!);
  }

  const slashDateMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashDateMatch) {
    return parseYearNumber(slashDateMatch[3]!);
  }

  const yearOnly = parseYearNumber(trimmed);
  if (yearOnly) return yearOnly;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  return Number.isFinite(year) ? year : null;
}

function payloadPersonRecord(payloadJson: unknown): Record<string, unknown> | null {
  if (!payloadJson || typeof payloadJson !== "object" || Array.isArray(payloadJson)) {
    return null;
  }
  const person = (payloadJson as Record<string, unknown>).person;
  if (!person || typeof person !== "object" || Array.isArray(person)) {
    return null;
  }
  return person as Record<string, unknown>;
}

export function payloadPersonBirthDate(payloadJson: unknown): string | null {
  const person = payloadPersonRecord(payloadJson);
  if (!person) return null;

  const birthDate = person.birthDate;
  if (typeof birthDate === "string" && birthDate.trim()) {
    return birthDate.trim();
  }

  if (typeof birthDate === "number" && Number.isFinite(birthDate)) {
    return String(birthDate);
  }

  return null;
}

export function payloadPersonBirthYear(payloadJson: unknown): number | null {
  const person = payloadPersonRecord(payloadJson);
  if (!person) return null;
  return parseYearNumber(person.birthYear);
}

/**
 * Canonical birth-year resolution for registration lifecycle rows.
 *
 * Fallback chain:
 * 1. Registration.birthYear
 * 2. Registration.birthDate → year
 * 3. detail-view player.birthDate → year
 * 4. detail-view player.birthYear
 * 5. payloadJson.person.birthDate → year
 * 6. payloadJson.person.birthYear
 * 7. linked Person.dateOfBirth → year (waiting-list rows only)
 */
export function resolveRegistrationBirthYear(
  registration: RegistrationBirthSource,
  player?: PlayerBirthFields,
  personDateOfBirth?: string | null,
): number | null {
  return (
    registration.birthYear ??
    deriveBirthYearFromDate(registration.birthDate) ??
    deriveBirthYearFromDate(player?.birthDate) ??
    player?.birthYear ??
    deriveBirthYearFromDate(payloadPersonBirthDate(registration.payloadJson)) ??
    payloadPersonBirthYear(registration.payloadJson) ??
    deriveBirthYearFromDate(personDateOfBirth)
  );
}
