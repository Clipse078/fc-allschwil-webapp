import { getRegistrationDetailFields, type RegistrationRawShape } from "./detail-view";

export type RegistrationApplicantMetadata = {
  birthYear: number | null;
  postalCode: string | null;
  city: string | null;
};

function deriveBirthYearFromDate(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const year = new Date(birthDate).getFullYear();
  return Number.isFinite(year) ? year : null;
}

/**
 * Operational applicant metadata for registration inbox rows.
 * Uses canonical registration fields / payloadJson address paths only.
 */
export function getRegistrationApplicantMetadata(
  registration: RegistrationRawShape,
): RegistrationApplicantMetadata {
  const birthYear = registration.birthYear ?? deriveBirthYearFromDate(registration.birthDate);
  const { address } = getRegistrationDetailFields(registration);

  return {
    birthYear,
    postalCode: address.postalCode,
    city: address.city,
  };
}
