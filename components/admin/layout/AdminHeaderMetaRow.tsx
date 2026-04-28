import Link from "next/link";
import AdminHeaderDateTime from "@/components/admin/layout/AdminHeaderDateTime";

type AdminHeaderMetaRowProps = {
  currentSeasonLabel: string;
  firstName: string;
  lastName: string;
  roleLabel: string;
};

function getInitials(firstName: string, lastName: string) {
  const first = (firstName ?? "").trim().charAt(0);
  const last = (lastName ?? "").trim().charAt(0);
  return `${first}${last}`.toUpperCase() || "FA";
}

export default function AdminHeaderMetaRow({
  firstName,
  lastName,
}: AdminHeaderMetaRowProps) {
  const initials = getInitials(firstName, lastName);
  const notificationCount = 0;

  return (
    <div className="hidden shrink-0 items-center gap-5 xl:flex">
      <div className="min-w-[168px] text-right">
        <AdminHeaderDateTime />
      </div>

      <Link
        href="/dashboard/profile"
        aria-label="Profil öffnen"
        title="Profil öffnen"
        className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[#0b4aa2] shadow-[0_10px_28px_rgba(15,23,42,0.07)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_16px_36px_rgba(11,74,162,0.14)]"
      >
        <span className="font-[var(--font-display)] text-[1rem] font-bold tracking-[-0.03em]">
          {initials}
        </span>

        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-[10px] font-black leading-none text-white shadow-sm">
          {notificationCount}
        </span>
      </Link>
    </div>
  );
}
