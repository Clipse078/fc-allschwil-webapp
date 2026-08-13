import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Clock,
  GitBranch,
  Layers,
  Pencil,
  Shield,
  Users,
} from "lucide-react";
import { auth } from "@/auth";
import { getOrgUnitById } from "@/lib/org/queries";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { prisma } from "@/lib/db/prisma";
import { getActorContext } from "@/lib/visibility/get-actor-context";
import { canAccessOrgUnit, canManageOrgUnit } from "@/lib/visibility/org-unit-access";
import { getEligibleTenantMembers } from "@/lib/roles/tenant-queries";
import {
  getScopedAssignmentsForOrgUnit,
} from "@/lib/roles/scoped-mutations";
import { getTenantClubAdminRoleKey } from "@/lib/roles/tenant-role-keys";
import OrgMembershipManagementCard from "@/components/admin/org/OrgMembershipManagementCard";
import OrgUnitSortControls from "@/components/admin/org/OrgUnitSortControls";
import OrgUnitArchiveButton from "@/components/admin/org/OrgUnitArchiveButton";
import OrgUnitRestoreButton from "@/components/admin/org/OrgUnitRestoreButton";
import ScopedResponsibilitiesCard from "@/components/admin/shared/ScopedResponsibilitiesCard";
import { PageShell, SectionCard } from "@/components/ui/page";
import { DetailPagePattern } from "@/components/ui/patterns";
import { Badge, Card } from "@/components/ui";
import { PropertyGrid } from "@/components/ui/PropertyGrid";
import { MetadataCard } from "@/components/ui/MetadataCard";
import { TimelinePlaceholder } from "@/components/ui/TimelinePlaceholder";

// RPERM-04: tenant resolved via the single tenant-context helper (session.activeTenantId,
// derived from TenantMembership — never the legacy User.tenantId column).
// Slice 11.5: sibling sort controls and parent breadcrumb added.
// Slice 12.3: archive button added to danger zone in sidebar.
// Phase 2 (org-based permissions): access now granted to ORG_VIEW/ORG_MANAGE holders
// OR to active members of this specific org unit (canAccessOrgUnit). Write actions
// (edit, archive, restore) still require ORG_MANAGE.

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
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  // Phase 2: build actor context to check org-unit membership in addition to permissions.
  const actor = await getActorContext(session.user, session.user?.activeTenantId ?? undefined);

  // Access check: global ORG_VIEW/ORG_MANAGE permission OR active member of this specific unit.
  // canAccessOrgUnit() is narrow: belonging to unit X never grants access to unit Y.
  if (!canAccessOrgUnit(id, actor)) {
    redirect("/dashboard");
  }

  const [unit, tenant, roles, seasons] = await Promise.all([
    getOrgUnitById(id),
    getActiveTenant(),
    prisma.role.findMany({
      orderBy: { name: "asc" },
      select: { id: true, key: true, name: true },
    }),
    prisma.season.findMany({
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, key: true, isActive: true },
    }),
  ]);
  if (!unit) notFound();
  // Tenant guard: null tenantId = pre-migration residue; allow (backwards-compat).
  if (unit.tenantId !== null && tenant && unit.tenantId !== tenant.id) notFound();

  // ORG-ACCESS-02: load scoped responsibilities and eligible users in parallel.
  const [scopedAssignments, eligibleUsers, tenantRolesForResponsibilities] =
    tenant
      ? await Promise.all([
          getScopedAssignmentsForOrgUnit(tenant.id, id),
          getEligibleTenantMembers(tenant.id),
          prisma.role.findMany({
            where: {
              scope: "TENANT",
              tenantId: tenant.id,
              isArchived: false,
              // Exclude the canonical Club Admin role (must remain tenant-wide only).
              key: { not: getTenantClubAdminRoleKey(tenant.key) },
            },
            orderBy: { name: "asc" },
            select: { id: true, key: true, name: true, isSystem: true },
          }),
        ])
      : [[], [], []];

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
  const memberCount = unit.memberships.length;
  const childCount = unit.children.length;
  // Write access requires ORG_MANAGE — membership-based access is read-only.
  const canManage = canManageOrgUnit(actor);
  const canArchive = canManage && unit.status !== "ARCHIVED" && childCount === 0;
  const canRestore = canManage && unit.status === "ARCHIVED";

  // Build breadcrumb items from ancestors
  const breadcrumbs = [
    { label: "Organisationseinheiten", href: "/dashboard/org-units" },
    ...ancestors.map((a) => ({ label: a.name, href: `/dashboard/org-units/${a.id}` })),
    { label: unit.name },
  ];

  const formatDate = (date: Date) =>
    date.toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  return (
    <PageShell fullWidth>
      <DetailPagePattern
        eyebrow="Organisationseinheiten"
        title={unit.name}
        headerBadge={
          <Badge
            variant={
              unit.status === "ACTIVE"
                ? "success"
                : unit.status === "ARCHIVED"
                ? "danger"
                : "default"
            }
          >
            {statusLabel}
          </Badge>
        }
        breadcrumbs={breadcrumbs}
        headerActions={
          <div className="flex items-center gap-2">
            {canManage ? (
              <Link
                href={`/dashboard/org-units/${unit.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-sm font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
              >
                <Pencil className="h-3.5 w-3.5" />
                Bearbeiten
              </Link>
            ) : null}
            <Link
              href="/dashboard/org-units"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-transparent px-3.5 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Zurück
            </Link>
          </div>
        }
        summary={
          <Card variant="section" noPadding>
            <div className="px-5 py-4">
              <PropertyGrid
                items={[
                  { label: "Typ", value: typeLabel },
                  {
                    label: "Key",
                    value: (
                      <code className="font-mono text-[0.8rem]">{unit.key}</code>
                    ),
                  },
                  {
                    label: "Ebene",
                    value: (
                      <span className="flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5" />
                        {unit.level}
                      </span>
                    ),
                  },
                  {
                    label: "Übergeordnete Einheit",
                    value: unit.parent?.name,
                    href: unit.parent
                      ? `/dashboard/org-units/${unit.parent.id}`
                      : undefined,
                    icon: <Building2 className="h-3.5 w-3.5" />,
                    emptyText: "Haupteinheit",
                  },
                  {
                    label: "Mitglieder",
                    value: `${memberCount}`,
                    icon: <Users className="h-3.5 w-3.5" />,
                  },
                  {
                    label: "Untereinheiten",
                    value: childCount > 0 ? `${childCount}` : null,
                    icon: <GitBranch className="h-3.5 w-3.5" />,
                    emptyText: "Keine",
                  },
                ]}
                columns={3}
              />
            </div>
          </Card>
        }
        sidebar={
          <>
            {/* Description */}
            {unit.description ? (
              <SectionCard title="Beschreibung">
                <p className="text-sm leading-relaxed text-[var(--text-2)]">
                  {unit.description}
                </p>
              </SectionCard>
            ) : null}

            {/* System metadata */}
            <MetadataCard
              fields={[
                { label: "Erstellt", value: formatDate(unit.createdAt) },
                { label: "Zuletzt geändert", value: formatDate(unit.updatedAt) },
                ...(unit.archivedAt
                  ? [{ label: "Archiviert", value: formatDate(unit.archivedAt) }]
                  : []),
              ]}
            />

            {/* Danger zone — archive action */}
            {canArchive ? (
              <Card variant="warning">
                <div className="px-5 py-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--sce-warning)]">
                    Gefahrenzone
                  </p>
                  <OrgUnitArchiveButton
                    orgUnitId={unit.id}
                    orgUnitName={unit.name}
                  />
                </div>
              </Card>
            ) : null}

            {/* Info: non-leaf units cannot be archived */}
            {canManage && unit.status !== "ARCHIVED" && childCount > 0 ? (
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-[12px] text-amber-700">
                Diese Einheit hat {childCount} untergeordnete
                {childCount === 1 ? " Einheit" : " Einheiten"}. Archiviere
                zuerst alle untergeordneten Einheiten.
              </div>
            ) : null}

            {/* Restore zone */}
            {canRestore ? (
              <SectionCard title="Wiederherstellung">
                {unit.archivedAt ? (
                  <p className="mb-3 text-[12px] text-[var(--muted)]">
                    Archiviert am {formatDate(unit.archivedAt)}
                  </p>
                ) : null}
                <OrgUnitRestoreButton
                  orgUnitId={unit.id}
                  orgUnitName={unit.name}
                  redirectToList={false}
                />
              </SectionCard>
            ) : null}

            <TimelinePlaceholder />
          </>
        }
      >
        {/* Tab navigation */}
        <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
          <span className="flex items-center gap-1.5 rounded-lg bg-[var(--surface-2)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
            <Users className="h-4 w-4" />
            Aktive Mitglieder
          </span>
          <Link
            href={`/dashboard/org-units/${unit.id}/history`}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
          >
            <Clock className="h-4 w-4" />
            Verlauf
          </Link>
        </div>

        {/* Untereinheiten */}
        {unit.children.length > 0 ? (
          <SectionCard
            title="Untereinheiten"
            noPadding
            headerActions={
              <Badge variant="default" size="sm">
                {unit.children.length}
              </Badge>
            }
          >
            <div className="divide-y divide-[var(--border)]">
              {unit.children.map((child) => {
                const childTypeLabel = TYPE_LABELS[child.type] ?? child.type;
                const childBg =
                  CHILD_TYPE_COLORS[child.type] ?? CHILD_TYPE_COLORS.CUSTOM;

                return (
                  <Link
                    key={child.id}
                    href={`/dashboard/org-units/${child.id}`}
                    className="group flex items-center gap-4 px-5 py-3.5 transition hover:bg-[var(--surface-2)]"
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${childBg}`}
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
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--sce-primary)]" />
                  </Link>
                );
              })}
            </div>
          </SectionCard>
        ) : null}

        {/* Teams */}
        <SectionCard
          title="Teams"
          noPadding
          headerActions={
            unit.teams.length > 0 ? (
              <Badge variant="default" size="sm">
                {unit.teams.length}
              </Badge>
            ) : undefined
          }
        >
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
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50">
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
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--sce-primary)]" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-4">
              <p className="text-sm text-[var(--muted)]">
                Keine Teams mit dieser Organisationseinheit verknüpft.
              </p>
            </div>
          )}
        </SectionCard>

        {/* Sibling reorder */}
        {siblings.length > 1 ? (
          <SectionCard title="Reihenfolge">
            <p className="mb-3 text-sm text-[var(--muted)]">
              Position dieser Einheit unter den Geschwistern.
            </p>
            <OrgUnitSortControls
              orgUnitId={unit.id}
              position={siblingPosition >= 0 ? siblingPosition : 0}
              total={siblings.length}
            />
          </SectionCard>
        ) : null}

        {/* Membership management */}
        <OrgMembershipManagementCard
          orgUnitId={unit.id}
          initialMemberships={unit.memberships}
          roles={roles}
          seasons={seasons}
        />

        {/* ORG-ACCESS-02: Scoped role responsibilities */}
        <ScopedResponsibilitiesCard
          orgUnitId={unit.id}
          orgUnitName={unit.name}
          initialAssignments={scopedAssignments}
          availableRoles={tenantRolesForResponsibilities}
          eligibleUsers={eligibleUsers}
          showScopeModeSelector={true}
          canManage={canManage}
        />
      </DetailPagePattern>
    </PageShell>
  );
}
