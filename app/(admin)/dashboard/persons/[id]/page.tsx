import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, Pencil, Calendar, FileText, Shield, UserCheck } from "lucide-react";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getPersonById } from "@/lib/people/queries";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import PersonRoleBadge from "@/components/admin/shared/PersonRoleBadge";

type PageProps = { params: Promise<{ id: string }> };

function formatDate(date: Date): string {
  return date.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function DataField({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ReactNode;
}) {
  return (
    <div className="sce-data-field">
      <span className="sce-data-label">{label}</span>
      {value ? (
        <span className="sce-data-value flex items-center gap-2">
          {icon ? <span className="text-[var(--muted)]">{icon}</span> : null}
          {value}
        </span>
      ) : (
        <span className="sce-data-value-empty">—</span>
      )}
    </div>
  );
}

export default async function PersonDetailPage({ params }: PageProps) {
  await requirePermission(PERMISSIONS.PEOPLE_VIEW);

  const { id } = await params;
  const person = await getPersonById(id);
  if (!person) notFound();

  const fullName =
    person.displayName || `${person.firstName} ${person.lastName}`;
  const initials = getInitials(person.firstName, person.lastName);
  const hasRoles = person.isPlayer || person.isTrainer;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="sce-entity-hero">
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="sce-avatar-xl">
              {initials}
            </div>

            {/* Identity */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                Personenprofil
              </p>
              <h1 className="mt-1 text-2xl font-bold text-white" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}>
                {fullName}
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <AdminStatusPill
                  label={person.isActive ? "Aktiv" : "Inaktiv"}
                  tone={person.isActive ? "success" : "muted"}
                />
                {hasRoles ? (
                  <PersonRoleBadge
                    isPlayer={person.isPlayer}
                    isTrainer={person.isTrainer}
                  />
                ) : (
                  <span className="sce-role-badge sce-role-badge-member">
                    Mitglied
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/dashboard/persons/${person.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/25"
            >
              <Pencil className="h-3.5 w-3.5" />
              Bearbeiten
            </Link>
            <Link
              href="/dashboard/persons"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur-sm transition hover:bg-white/20 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Zurück
            </Link>
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        {/* Main column */}
        <div className="space-y-5">
          {/* Stammdaten */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Stammdaten
              </p>
            </div>
            <div className="sce-detail-section-body grid gap-5 sm:grid-cols-2">
              <DataField label="Vorname" value={person.firstName} />
              <DataField label="Nachname" value={person.lastName} />
              {person.displayName ? (
                <DataField label="Anzeigename" value={person.displayName} />
              ) : null}
              <DataField
                label="Geburtsdatum"
                value={person.dateOfBirth ? formatDate(person.dateOfBirth) : null}
                icon={<Calendar className="h-3.5 w-3.5" />}
              />
            </div>
          </div>

          {/* Notizen */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Notizen
              </p>
              <FileText className="h-4 w-4 text-[var(--muted)]" />
            </div>
            <div className="sce-detail-section-body">
              {person.notes ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-2)]">
                  {person.notes}
                </p>
              ) : (
                <p className="text-sm italic text-[var(--muted)]">
                  Keine Notizen hinterlegt.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Kontakt */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Kontakt
              </p>
            </div>
            <div className="sce-detail-section-body space-y-4">
              {person.email ? (
                <div className="sce-data-field">
                  <span className="sce-data-label">E-Mail</span>
                  <a
                    href={`mailto:${person.email}`}
                    className="sce-data-value flex items-center gap-2 text-[var(--blue)] hover:underline"
                  >
                    <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                    {person.email}
                  </a>
                </div>
              ) : (
                <DataField label="E-Mail" value={null} />
              )}
              {person.phone ? (
                <div className="sce-data-field">
                  <span className="sce-data-label">Telefon</span>
                  <a
                    href={`tel:${person.phone}`}
                    className="sce-data-value flex items-center gap-2 text-[var(--blue)] hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                    {person.phone}
                  </a>
                </div>
              ) : (
                <DataField label="Telefon" value={null} />
              )}
            </div>
          </div>

          {/* Rollen & Status */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Rollen & Status
              </p>
            </div>
            <div className="sce-detail-section-body space-y-3">
              <div className="flex flex-wrap gap-2">
                <AdminStatusPill
                  label={person.isActive ? "Aktiv" : "Inaktiv"}
                  tone={person.isActive ? "success" : "muted"}
                />
              </div>

              <div className="space-y-2 pt-1">
                <RoleIndicator
                  label="Spieler"
                  active={person.isPlayer}
                  icon={<Shield className="h-4 w-4" />}
                />
                <RoleIndicator
                  label="Trainer"
                  active={person.isTrainer}
                  icon={<UserCheck className="h-4 w-4" />}
                />
              </div>
            </div>
          </div>

          {/* Metadaten */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Systemdaten
              </p>
            </div>
            <div className="sce-detail-section-body space-y-3">
              <DataField
                label="Erstellt"
                value={formatDate(person.createdAt)}
              />
              <DataField
                label="Zuletzt geändert"
                value={formatDate(person.updatedAt)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoleIndicator({
  label,
  active,
  icon,
}: {
  label: string;
  active: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
        active
          ? "border-[var(--blue)] bg-[var(--blue-light)] text-[var(--blue)]"
          : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]"
      }`}
    >
      {icon}
      <span className="flex-1">{label}</span>
      <span
        className={`text-xs font-semibold ${active ? "text-[var(--blue)]" : "text-[var(--muted)]"}`}
      >
        {active ? "Ja" : "Nein"}
      </span>
    </div>
  );
}
