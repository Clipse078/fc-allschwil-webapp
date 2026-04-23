import Link from "next/link";
import { Settings2 } from "lucide-react";

type AdminHeaderUserPanelProps = {
  firstName: string;
  lastName: string;
  roleLabel: string;
  imageUrl?: string | null;
};

function getInitials(firstName: string, lastName: string) {
  const first = (firstName ?? "").trim().charAt(0);
  const last = (lastName ?? "").trim().charAt(0);
  return `${first}${last}`.toUpperCase() || "FA";
}

export default function AdminHeaderUserPanel({
  firstName,
  lastName,
  roleLabel,
  imageUrl,
}: AdminHeaderUserPanelProps) {
  const fullName = `${firstName} ${lastName}`.trim();
  const initials = getInitials(firstName, lastName);

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-gradient-to-br from-slate-50 to-white shadow-sm">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={fullName} className="h-full w-full object-cover" />
        ) : (
          <span className="font-[var(--font-display)] text-[1rem] font-bold tracking-[-0.03em] text-[#0b4aa2]">
            {initials}
          </span>
        )}
      </div>

      <div className="min-w-0">
        <p className="truncate text-[1rem] font-semibold tracking-tight text-slate-950">
          {fullName}
        </p>
        <p className="mt-1 truncate text-sm font-medium text-slate-500">
          {roleLabel}
        </p>
      </div>

      <Link
        href="/dashboard/profile"
        aria-label="Persönliche Einstellungen öffnen"
        title="Persönliche Einstellungen"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
      >
        <Settings2 className="h-5 w-5" />
      </Link>
    </div>
  );
}