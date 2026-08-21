import { cn } from "@/lib/cn";
import { getRegistrationApplicantMetadata } from "@/lib/registrations/applicant-metadata";
import type { RegistrationRawShape } from "@/lib/registrations/detail-view";

type Props = {
  registration: RegistrationRawShape;
  className?: string;
};

function MetadataPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 items-center rounded-full border border-slate-200 bg-slate-50 px-2 text-[0.65rem] font-semibold text-slate-600">
      {children}
    </span>
  );
}

export function RegistrationApplicantMetadataPills({ registration, className }: Props) {
  const { birthYear, postalCode, city } = getRegistrationApplicantMetadata(registration);

  if (!birthYear && !postalCode && !city) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {birthYear ? <MetadataPill>Jg. {birthYear}</MetadataPill> : null}
      {postalCode ? <MetadataPill>{postalCode}</MetadataPill> : null}
      {city ? <MetadataPill>{city}</MetadataPill> : null}
    </div>
  );
}
