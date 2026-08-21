import { cn } from "@/lib/cn";
import { getInitials } from "@/lib/inbox/types";
import { getRegistrationApplicantMetadata } from "@/lib/registrations/applicant-metadata";
import type { RegistrationRawShape } from "@/lib/registrations/detail-view";

type Props = {
  firstName: string;
  lastName: string;
  registration: RegistrationRawShape;
  personId?: string | null;
  personDateOfBirth?: string | null;
  locale?: string;
  timezone?: string;
  showClubManagementState?: boolean;
  className?: string;
};

function MetadataPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 items-center rounded-full border border-slate-200 bg-slate-50 px-2 text-[0.65rem] font-semibold text-slate-600">
      {children}
    </span>
  );
}

function RegistrationApplicantMetadataPills({
  registration,
  personDateOfBirth,
  locale,
  timezone,
  className,
}: {
  registration: RegistrationRawShape;
  personDateOfBirth?: string | null;
  locale?: string;
  timezone?: string;
  className?: string;
}) {
  const { birthYear, postalCode, city, receivedAtLabel } = getRegistrationApplicantMetadata(registration, {
    personDateOfBirth,
    locale,
    timezone,
  });

  if (!birthYear && !postalCode && !city && !receivedAtLabel) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {birthYear ? <MetadataPill>Jahrgang: {birthYear}</MetadataPill> : null}
      {postalCode ? <MetadataPill>Postleitzahl: {postalCode}</MetadataPill> : null}
      {city ? <MetadataPill>Ort: {city}</MetadataPill> : null}
      {receivedAtLabel ? <MetadataPill>Eingegangen: {receivedAtLabel}</MetadataPill> : null}
    </div>
  );
}

/**
 * Canonical compact applicant identity block for the registration lifecycle family.
 */
export function RegistrationApplicantIdentity({
  firstName,
  lastName,
  registration,
  personId = null,
  personDateOfBirth = null,
  locale = "de-CH",
  timezone = "Europe/Zurich",
  showClubManagementState = true,
  className,
}: Props) {
  const initials = getInitials(firstName, lastName);
  const linkedPerson = !!personId;

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] text-[0.65rem] font-bold uppercase text-[var(--blue)]">
        {initials}
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-[var(--foreground)]">
          {firstName} {lastName}
        </p>
        <RegistrationApplicantMetadataPills
          registration={registration}
          personDateOfBirth={personDateOfBirth}
          locale={locale}
          timezone={timezone}
          className="mt-0.5"
        />
        {showClubManagementState ? (
          linkedPerson ? (
            <p className="mt-0.5 text-[0.68rem] font-medium text-emerald-700">In Vereinsverwaltung</p>
          ) : (
            <p className="mt-0.5 text-[0.68rem] font-medium text-violet-600">
              Noch nicht in der Vereinsverwaltung
            </p>
          )
        ) : null}
      </div>
    </div>
  );
}

export { RegistrationApplicantMetadataPills };
