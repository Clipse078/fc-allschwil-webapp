import { getRegistrationDetailFields, type RegistrationRawShape } from "./detail-view";

export type RegistrationApplicantMetadata = {
  birthYear: number | null;
  postalCode: string | null;
  city: string | null;
};

export function deriveBirthYearFromDate(birthDate: string | null): number | null {
  if (!birthDate) return null;

  const dateOnlyMatch = birthDate.match(/^(\d{4})-\d{2}-\d{2}/);
  if (dateOnlyMatch) {
    const year = Number.parseInt(dateOnlyMatch[1]!, 10);
    return Number.isFinite(year) ? year : null;
  }

  const parsed = new Date(birthDate);
  const year = parsed.getFullYear();
  return Number.isFinite(year) ? year : null;
}

function payloadPersonBirthDate(payloadJson: unknown): string | null {
  if (!payloadJson || typeof payloadJson !== "object" || Array.isArray(payloadJson)) {
    return null;
  }
  const person = (payloadJson as Record<string, unknown>).person;
  if (!person || typeof person !== "object" || Array.isArray(person)) {
    return null;
  }
  const birthDate = (person as Record<string, unknown>).birthDate;
  return typeof birthDate === "string" && birthDate.trim() ? birthDate.trim() : null;
}

/**
 * Operational applicant metadata for registration inbox rows.
 * Uses canonical registration fields / payloadJson address paths only.
 */
export function getRegistrationApplicantMetadata(
  registration: RegistrationRawShape,
): RegistrationApplicantMetadata {
  const { address, player } = getRegistrationDetailFields(registration);
  const birthYear =
    registration.birthYear ??
    deriveBirthYearFromDate(registration.birthDate) ??
    deriveBirthYearFromDate(player.birthDate) ??
    deriveBirthYearFromDate(payloadPersonBirthDate(registration.payloadJson));

  return {
    birthYear,
    postalCode: address.postalCode,
    city: address.city,
  };
}
