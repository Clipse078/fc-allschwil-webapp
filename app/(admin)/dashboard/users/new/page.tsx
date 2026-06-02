import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import UserForm from "@/components/admin/users/UserForm";
import { requirePermission } from "@/lib/permissions/require-permission";

export default async function NewUserPage() {
  await requirePermission("users.manage");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="fca-eyebrow">Benutzerverwaltung</p>
          <h2
            className="fca-heading mt-2 flex items-center gap-2"
          >
            <UserPlus className="h-6 w-6 text-[var(--blue)]" />
            Neuer Benutzer
          </h2>
          <p className="fca-body-muted mt-3 max-w-2xl">
            Lege ein neues Benutzerkonto für die WebApp an. Das temporäre
            Passwort sollte nach dem ersten Login geändert werden.
          </p>
        </div>
        <Link href="/dashboard/users" className="fca-button-secondary self-start md:self-auto">
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </Link>
      </div>

      {/* Form section */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            Kontoinformationen
          </p>
        </div>
        <div className="sce-detail-section-body">
          <UserForm mode="create" />
        </div>
      </div>
    </div>
  );
}
