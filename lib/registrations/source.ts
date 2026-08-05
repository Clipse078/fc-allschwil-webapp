/**
 * lib/registrations/source.ts
 *
 * REGISTRATION-01E — Goal 6: Registration source preparation.
 *
 * `Registration.source` is a free-form string column. Today every
 * registration is created with `source = "WEBSITE"` (see constants.ts /
 * public-submission.ts) — nothing about ingestion changes here.
 *
 * This module only introduces a stable, tenant-facing DISPLAY enum so the
 * UI is ready to present future intake channels (mobile app, manual entry,
 * CSV import, API) without another pass through every component that
 * currently hardcodes a "Website" badge.
 *
 * This is presentation-only: it does not affect validation, storage, or the
 * public registration API.
 */

export type RegistrationSourceKey =
  | "WEBSITE"
  | "MOBILE_APP"
  | "MANUAL"
  | "CSV_IMPORT"
  | "API"
  | "OTHER";

export type RegistrationSourceInfo = {
  key: RegistrationSourceKey;
  label: string;
};

const SOURCE_LABELS: Record<RegistrationSourceKey, string> = {
  WEBSITE: "Website",
  MOBILE_APP: "Mobile App",
  MANUAL: "Manuell",
  CSV_IMPORT: "CSV-Import",
  API: "API",
  OTHER: "Andere",
};

/**
 * Maps a raw `Registration.source` value to the stable display enum.
 * Returns `null` when no source was recorded (legacy / minimal registrations)
 * so callers can render "Nicht angegeben" instead of a misleading label.
 *
 * Unrecognised non-empty values fall back to `OTHER`, but the original raw
 * string is preserved as the label so no submitted information is hidden.
 */
export function getRegistrationSourceInfo(
  source: string | null | undefined,
): RegistrationSourceInfo | null {
  if (!source || !source.trim()) return null;

  const normalized = source.trim().toUpperCase();

  switch (normalized) {
    case "WEBSITE":
      return { key: "WEBSITE", label: SOURCE_LABELS.WEBSITE };
    case "MOBILE_APP":
    case "MOBILE":
    case "APP":
      return { key: "MOBILE_APP", label: SOURCE_LABELS.MOBILE_APP };
    case "MANUAL":
    case "ADMIN":
      return { key: "MANUAL", label: SOURCE_LABELS.MANUAL };
    case "CSV_IMPORT":
    case "CSV":
    case "IMPORT":
      return { key: "CSV_IMPORT", label: SOURCE_LABELS.CSV_IMPORT };
    case "API":
      return { key: "API", label: SOURCE_LABELS.API };
    default:
      // Unknown source string: never discard it, just label it generically.
      return { key: "OTHER", label: source.trim() };
  }
}
