import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  GitBranch,
  Hash,
  Layers,
  Pencil,
  Shield,
  Users,
} from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getOrgUnitById } from "@/lib/org/queries";
import { getDefaultTenant } from "@/lib/tenants/queries";
import { prisma } from "@/lib/db/prisma";
import OrgMembershipManagementCard from "@/components/admin/org/OrgMembershipManagementCard";
import OrgUnitSortControls from "@/components/admin/org/OrgUnitSortControls";

// Slice 11.2: tenant guard added. Cross-tenant OrgUnit IDs resolve to notFound().
// Slice 11.5: sibling sort controls and parent breadcrumb added.

const TYPE_LABELS: Record<string, string> = {
  CLUB: "Verein",
  DIVISION: "Abteilung",
  DEPARTMENT: "Ressort",
  SUB_DEPARTMENT: "Unterressort",
  TEAM: "Mannschaft",
  COMMITTEE: "Ausschuss",
  PROJECT_GROUP: "Projektgruppe",
  CUSTOM: "Benutzerdefiniert",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktiv",
  INACTIVE: "Inaktiv",
  ARCHIVED: "Archiviert",
};

const CHILD_TYPE_COLORS: Record<string, string> = {
  CLUB: "bg-blue-50 border-blue-100",
  DIVISION: "bg-indigo-50 border-indigo-100",
  DEPARTMENT: "bg-violet-50 border-violet-100",
  SUB_DEPARTMENT: "bg-purple-50 border-purple-100",
  TEAM: "bg-emerald-50 border-emerald-100",
  COMMITTEE: "bg-amber-50 border-amber-100",
  PROJECT_GROUP: "bg-orange-50 border-orange-100",
  CUSTOM: "bg-slate-50 border-slate-200",
};

type PageProps = { params: Promise<{ id: string }> };

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

export default async function OrgUnitDetailPage({ params }: PageProps) {
  await requireAnyPermission([PERMISSIONS.ORG_VIEW, PERMISSIONS.ORG_MANAGE]);
  const { id } = await params;
  const [unit, tenant, roles] = await Promise.all([
    getOrgUnitById(id),
    getDefaultTenant(),
    prisma.role.findMany({
      orderBy: { name: "asc" },
      select: { id: true, key: true, name: true },
    }),
  ]);
  if (!unit) notFound();
  // Tenant guard: null tenantId = pre-migration residue; allow (backwards-compat).
  if (unit.tenantId !== null && tenant && unit.tenantId !== tenant.id) notFound();

  // Sibling list for reorder controls (same parentId, same tenant).
  const siblings = tenant
    ? await prisma.orgUnit.findMany({
        where: { tenantId: tenant.id, parentId: unit.parentId },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true },
      })
    : [];
  const siblingPosition = siblings.findIndex((s) => s.id === id);

  // Ancestor chain for breadcrumb (max 2 ancestors given max depth 3).
  const ancestors: Array<{ id: string; name: string }> = [];
  if (unit.parent) {
    if (unit.level === 2) {
      const grandparent = await prisma.orgUnit
        .findUnique({ where: { id: unit.parent.id }, select: { parentId: true } })
        .then(async (p: { parentId: string | null } | null) => {
          if (!p?.parentId) return null;
          return prisma.orgUnit.findUnique({
            where: { id: p.parentId },
            select: { id: true, name: true },
          });
        });
      if (grandparent) ancestors.push(grandparent);
    }
    ancestors.push({ id: unit.parent.id, name: unit.parent.name });
  }

  const typeLabel = TYPE_LABELS[unit.type] ?? unit.type;
  const statusLabel = STATUS_LABELS[unit.status] ?? unit.status;
  const initials = getInitials(unit.name);
  const memberCount = unit.memberships.length;
  const childCount = unit.children.length;

  return (
    <div className="space-y-6">
      {/* Ancestor breadcrumb */}
      {ancestors.length > 0 ? (
        <nav className="flex flex-wrap items-center gap-1 text-sm text-[var(--muted)]">
          <Link href="/dashboard/org-units" className="hover:text-[var(--blue)]">
            Organisationseinheiten
          </Link>
          {ancestors.map((ancestor) => (
            <span key={ancestor.id} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
              <Link
                href={`/dashboard/org-units/${ancestor.id}`}
                className="hover:text-[var(--blue)]"
              >
                {ancestor.name}
              </Link>
            </span>
          ))}
          <span className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="font-medium text-[var(--foreground)]">{unit.name}</span>
          </span>
        </nav>
      ) : null}

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
                {typeLabel}
              </p>
              <h1
                className="mt-1 text-2xl font-bold text-white"
                style={{
                  fontFamily: "var(--font-display)",
                  letterSpacing: "-0.01em",
                }}
              >
                {unit.name}
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {/* Status */}
                <span
                  className={`inline-flex h-5 items-center rounded-full border px-2.5 text-[0.65rem] font-semibold ${
                    unit.status === "ACTIVE"
                      ? "border-emerald-300/60 bg-emerald-500/20 text-emerald-200"
                      : "border-white/20 bg-white/10 text-white/60"
                  }`}
                >
                  {statusLabel}
                </span>
                {/* Key */}
                <code className="rounded border border-white/20 bg-white/10 px-2 py-0.5 text-[0.72rem] font-mono text-white/80">
                  {unit.key}
                </code>
                {/* Level */}
                <span className="inline-flex items-center gap-1 text-xs text-white/60">
                  <Layers className="h-3 w-3" />
                  Ebene {unit.level}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/dashboard/org-units/${unit.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/25"
            >
              <Pencil className="h-3.5 w-3.5" />
              Bearbeiten
            </Link>
            <Link
              href="/dashboard/org-units"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur-sm transition hover:bg-white/20 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Zurück
            </Link>
          </div>
        </div>

        {/* Quick stats */}
        <div className="relative z-10 mt-6 flex flex-wrap gap-6 border-t border-white/15 pt-4">
          <div className="flex items-center gap-2 text-sm text-white/80">
            <Users className="h-4 w-4 text-white/60" />
            <span className="font-semibold text-white">{memberCount}</span>
            <span>Mitglied{memberCount !== 1 ? "er" : ""}</span>
          </div>
          {childCount > 0 ? (
            <div className="flex items-center gap-2 text-sm text-white/80">
              <GitBranch className="h-4 w-4 text-white/60" />
              <span className="font-semibold text-white">{childCount}</span>
              <span>Untereinheit{childCount !== 1 ? "en" : ""}</span>
            </div>
          ) : null}
          {unit.parent ? (
            <div className="flex items-center gap-2 text-sm text-white/80">
              <Building2 className="h-4 w-4 text-white/60" />
              <span>unter</span>
              <span className="font-semibold text-white">
                {unit.parent.name}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Content grid */}
      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        {/* Main column */}
        <div className="space-y-5">
          {/* Untereinheiten */}
          {unit.children.length > 0 ? (
            <div className="sce-detail-section">
              <div className="sce-detail-section-header">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-[var(--muted)]" />
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                    Untereinheiten
                  </p>
                  <span className="sce-count-badge">{unit.children.length}</span>
                </div>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {unit.children.map((child) => {
                  const childTypeLabel = TYPE_LABELS[child.type] ?? child.type;
                  const childBg =
                    CHILD_TYPE_COLORS[child.type] ?? CHILD_TYPE_COLORS.CUSTOM;

                  return (
                    <Link
                      key={child.id}
                      href={`/dashboard/org-units/${child.id}`}
                      className={`group flex items-center gap-4 px-5 py-3.5 transition hover:bg-[var(--surface-2)]`}
                    >
                      <div
                        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border ${childBg}`}
                      >
                        <Building2 className="h-4 w-4 text-[var(--text-2)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {child.name}
                        </p>
                        <p className="text-xs text-[var(--muted)]">
                          {childTypeLabel}
                          {" · "}
                          <code className="font-mono">{child.key}</code>
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--blue)]" />
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Teams linked via Team.orgUnitId (Slice 11.3) */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Teams
                </p>
                {unit.teams.length > 0 ? (
                  <span className="sce-count-badge">{unit.teams.length}</span>
                ) : null}
              </div>
            </div>
            {unit.teams.length > 0 ? (
              <div className="divide-y divide-[var(--border)]">
                {unit.teams.map((team) => {
                  const activeSeason = team.teamSeasons[0] ?? null;
                  return (
                    <Link
                      key={team.id}
                      href={`/dashboard/teams/${team.id}`}
                      className="group flex items-center gap-4 px-5 py-3.5 transition hover:bg-[var(--surface-2)]"
                    >
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50">
                        <Shield className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {activeSeason?.displayName ?? team.name}
                        </p>
                        {activeSeason ? (
                          <p className="text-xs text-[var(--muted)]">
                            {activeSeason.season.name}
                          </p>
                        ) : null}
                      </div>
                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--blue)]" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="sce-detail-section-body">
                <p className="text-sm text-[var(--muted)]">
                  No teams linked to this organisation unit yet.
                </p>
              </div>
            )}
          </div>

          {/* Sibling reorder (Slice 11.5) */}
          {siblings.length > 1 ? (
            <div className="sce-detail-section">
              <div className="sce-detail-section-header">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[var(--muted)]" />
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                    Reihenfolge
                  </p>
                </div>
              </div>
              <div className="sce-detail-section-body">
                <p className="mb-3 text-sm text-[var(--muted)]">
                  Position dieser Einheit unter den Geschwistern.
                </p>
                <OrgUnitSortControls
                  orgUnitId={unit.id}
                  position={siblingPosition >= 0 ? siblingPosition : 0}
                  total={siblings.length}
                />
              </div>
            </div>
          ) : null}

          {/* Membership management (Slice 11.4: role picker) */}
          <OrgMembershipManagementCard
            orgUnitId={unit.id}
            initialMemberships={unit.memberships}
            roles={roles}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Details */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Details
              </p>
            </div>
            <div className="sce-detail-section-body space-y-4">
              <div className="sce-data-field">
                <span className="sce-data-label">Typ</span>
                <span className="sce-data-value">{typeLabel}</span>
              </div>
              <div className="sce-data-field">
                <span className="sce-data-label">Key</span>
                <code className="sce-data-value font-mono text-[0.8rem]">
                  {unit.key}
                </code>
              </div>
              <div className="sce-data-field">
                <span className="sce-data-label">Ebene</span>
                <span className="sce-data-value flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-[var(--muted)]" />
                  {unit.level}
                </span>
              </div>
              {unit.parent ? (
                <div className="sce-data-field">
                  <span className="sce-data-label">Übergeordnete Einheit</span>
                  <Link
                    href={`/dashboard/org-units/${unit.parent.id}`}
                    className="sce-data-value flex items-center gap-1.5 text-[var(--blue)] hover:underline"
                  >
                    <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                    {unit.parent.name}
                  </Link>
                </div>
              ) : (
                <div className="sce-data-field">
                  <span className="sce-data-label">Übergeordnete Einheit</span>
                  <span className="sce-data-value-empty">Keine (Haupteinheit)</span>
                </div>
              )}
              <div className="sce-data-field">
                <span className="sce-data-label">Status</span>
                <span className="sce-data-value">{statusLabel}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          {unit.description ? (
            <div className="sce-detail-section">
              <div className="sce-detail-section-header">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Beschreibung
                </p>
              </div>
              <div className="sce-detail-section-body">
                <p className="text-sm leading-relaxed text-[var(--text-2)]">
                  {unit.description}
                </p>
              </div>
            </div>
          ) : null}

          {/* Key info card */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Systeminfo
                </p>
              </div>
            </div>
            <div className="sce-detail-section-body space-y-4">
              <div className="sce-data-field">
                <span className="sce-data-label">Erstellt</span>
                <span className="sce-data-value">
                  {unit.createdAt.toLocaleDateString("de-CH", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="sce-data-field">
                <span className="sce-data-label">Zuletzt geändert</span>
                <span className="sce-data-value">
                  {unit.updatedAt.toLocaleDateString("de-CH", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
