import { formatDateShort, type TenantFormatConfig } from "@/lib/tenant-runtime/formatters";
import { resolveRegistrationBirthYear } from "./birth-year";
import { getRegistrationDetailFields, type RegistrationRawShape } from "./detail-view";

export type RegistrationApplicantMetadata = {
  birthYear: number | null;
  postalCode: string | null;
  city: string | null;
  receivedAtLabel: string | null;
};

export { deriveBirthYearFromDate, payloadPersonBirthDate, payloadPersonBirthYear, resolveRegistrationBirthYear } from "./birth-year";

export function formatApplicantReceivedDate(
  submittedAt: string | null | undefined,
  cfg: TenantFormatConfig,
): string | null {
  if (!submittedAt) return null;
  return formatDateShort(submittedAt, cfg);
}

type ApplicantMetadataOptions = {
  personDateOfBirth?: string | null;
  locale?: string;
  timezone?: string;
};

/**
 * Operational applicant metadata for registration lifecycle rows.
 * Uses canonical registration fields / payloadJson paths only.
 */
export function getRegistrationApplicantMetadata(
  registration: RegistrationRawShape,
  options: ApplicantMetadataOptions = {},
): RegistrationApplicantMetadata {
  const { address, player } = getRegistrationDetailFields(registration);
  const birthYear = resolveRegistrationBirthYear(
    registration,
    player,
    options.personDateOfBirth,
  );

  const cfg: TenantFormatConfig = {
    locale: options.locale ?? "de-CH",
    timezone: options.timezone ?? "Europe/Zurich",
  };

  return {
    birthYear,
    postalCode: address.postalCode,
    city: address.city,
    receivedAtLabel: formatApplicantReceivedDate(registration.submittedAt, cfg),
  };
}
