import AdminHeaderDateTime from "@/components/admin/layout/AdminHeaderDateTime";
import AdminHeaderSeasonContext from "@/components/admin/layout/AdminHeaderSeasonContext";
import AdminHeaderUserPanel from "@/components/admin/layout/AdminHeaderUserPanel";

type AdminHeaderMetaRowProps = {
  currentSeasonLabel: string;
  firstName: string;
  lastName: string;
  roleLabel: string;
};

export default function AdminHeaderMetaRow({
  currentSeasonLabel,
  firstName,
  lastName,
  roleLabel,
}: AdminHeaderMetaRowProps) {
  return (
    <div className="flex flex-col items-start gap-4 lg:flex-row lg:items-center lg:gap-8 xl:justify-end">
      <AdminHeaderSeasonContext currentSeasonLabel={currentSeasonLabel} />
      <div className="hidden h-14 w-px bg-slate-200 lg:block" />
      <AdminHeaderUserPanel
        firstName={firstName}
        lastName={lastName}
        roleLabel={roleLabel}
      />
      <div className="hidden h-14 w-px bg-slate-200 lg:block" />
      <AdminHeaderDateTime />
    </div>
  );
}