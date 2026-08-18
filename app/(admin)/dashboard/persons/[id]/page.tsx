/**
 * PERSON-UX-01 — Canonical Person 360° Workspace.
 *
 * /dashboard/persons/[id] is the canonical Person Workspace. A Person is
 * the canonical human record across the entire club and may simultaneously be:
 * player · trainer/staff · management/board · volunteer/employee · member
 *
 * Security principle: "One canonical Person, separately authorized domains."
 * Generic people.view access does NOT grant access to medical, financial, or
 * private document data. Those require dedicated permissions (introduced in later slices).
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, ArrowLeft, Mail, Phone, Calendar } from "lucide-react";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getPersonById,
  getPersonAssignments,
  getOrgUnitsForTenant,
  getTeamsForTenant,
  getActiveSeasonForTenant,
  getPersonSquadMemberships,
  getPersonTrainerMemberships,
} from "@/lib/people/queries";
import { getActiveTenantId } from "@/lib/tenants/active-tenant";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { prisma } from "@/lib/db/prisma";
import { PageShell } from "@/components/ui/page";
import { DetailPagePattern } from "@/components/ui/patterns";
import { Badge, StatusIndicator } from "@/components/ui";
import { MetadataCard } from "@/components/ui/MetadataCard";
import AdminAvatar from "@/components/admin/shared/AdminAvatar";
import PersonDetailTabs from "@/components/admin/persons/PersonDetailTabs";
import PersonDeleteButton from "@/components/admin/persons/PersonDeleteButton";
import { TENANT_ROLES_ASSIGN, TENANT_ROLES_VIEW } from "@/lib/roles/access";
import { getTenantRoleAssignmentForUser, getTenantRolesOverview } from "@/lib/roles/tenant-queries";
import { getPersonFunctionLabel } from "@/lib/people/functions";

type PageProps = { params: Promise<{ id: string }> };

function formatDate(date: Date): string {
  return date.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const m = today.getMonth() - dateOfBirth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dateOfBirth.getDate())) age--;
  return age;
}

export default async function PersonDetailPage({ params }: PageProps) {
  const session = await requirePermission(PERMISSIONS.PEOPLE_VIEW);

  const { id } = await params;
  const person = await getPersonById(id);
  if (!person) notFound();

  const tenantId = await getActiveTenantId();

  // Tenant isolation
  if (person.tenantId && tenantId && person.tenantId !== tenantId) {
    notFound();
  }

  const [assignments, orgUnits, teams, activeSeason, squadMemberships, trainerMemberships] =
    await Promise.all([
      getPersonAssignments(id),
      tenantId ? getOrgUnitsForTenant(tenantId) : Promise.resolve([]),
      tenantId ? getTeamsForTenant(tenantId) : Promise.resolve([]),
      tenantId ? getActiveSeasonForTenant(tenantId) : Promise.resolve(null),
      getPersonSquadMemberships(id),
      getPersonTrainerMemberships(id),
    ]);

  const fullName = person.displayName || `${person.firstName} ${person.lastName}`;

  // Resolve permissions
  const resolver = createEffectivePermissionResolver(prisma);
  const { platform, tenant } = tenantId
    ? await resolver.getEffectivePermissions({ userId: session.user.id, tenantId })
    : { platform: [] as string[], tenant: [] as string[] };

  const allPerms = [...platform, ...tenant];
  const canManage = allPerms.includes(PERMISSIONS.PEOPLE_MANAGE);
  const canDelete = allPerms.includes(PERMISSIONS.PEOPLE_DELETE);

  // ── Header badges: capacities from ALL sources ──────────────────────────────
  // PersonAssignment active functions
  const assignmentFunctions = [
    ...new Set(
      assignments
        .filter((a) => a.status === "ACTIVE" && a.functionKey)
        .map((a) => getPersonFunctionLabel(a.functionKey)),
    ),
  ];

  // Squad (player) memberships
  const activeSquads = squadMemberships.filter(
    (m) => m.status === "ACTIVE" || m.status === "INJURED" || m.status === "ABSENT",
  );
  const isCurrentPlayer = activeSquads.length > 0;

  // Trainer memberships
  const activeTrainers = trainerMemberships.filter((m) => m.status === "ACTIVE");
  const isCurrentTrainer = activeTrainers.length > 0;

  // Deduplicated header capacity labels (max 4 to avoid overflow)
  const capacityLabels: string[] = [];
  if (isCurrentPlayer && !assignmentFunctions.includes("Spieler/in")) {
    capacityLabels.push("Spieler/in");
  }
  if (isCurrentTrainer) {
    const trainerLabel = activeTrainers[0]?.roleLabel ?? "Trainer/in";
    if (!assignmentFunctions.includes(trainerLabel)) {
      capacityLabels.push(trainerLabel);
    }
  }
  for (const fn of assignmentFunctions) {
    if (capacityLabels.length >= 4) break;
    capacityLabels.push(fn);
  }
  const headerCapacities = capacityLabels.slice(0, 4);

  // ── AccessRolesCard data — moved to Zugang tab ──────────────────────────────
  let accessRolesCard: {
    linkedUser: { id: string; email: string } | null;
    isActiveTenantMember: boolean;
    roles: { id: string; name: string; isSystem: boolean; isArchived: boolean; activeAssigneeCount: number }[];
    assignedRoleIds: string[];
    canAssign: boolean;
  } | null = null;

  if (!person.user) {
    const canAssign = tenantId
      ? TENANT_ROLES_ASSIGN.some((key) => allPerms.includes(key))
      : false;
    accessRolesCard = {
      linkedUser: null,
      isActiveTenantMember: false,
      roles: [],
      assignedRoleIds: [],
      canAssign,
    };
  } else if (tenantId) {
    const canView = TENANT_ROLES_VIEW.some((key) => allPerms.includes(key));
    const canAssign = TENANT_ROLES_ASSIGN.some((key) => allPerms.includes(key));
    if (canView) {
      const [roles, assignment] = await Promise.all([
        getTenantRolesOverview(tenantId),
        getTenantRoleAssignmentForUser(tenantId, person.user.id),
      ]);
      accessRolesCard = {
        linkedUser: { id: person.user.id, email: person.user.email },
        isActiveTenantMember: assignment?.isActiveMember ?? false,
        roles: roles.map((r) => ({
          id: r.id,
          name: r.name,
          isSystem: r.isSystem,
          isArchived: r.isArchived,
          activeAssigneeCount: r.userCount,
        })),
        assignedRoleIds: assignment?.roleIds ?? [],
        canAssign,
      };
    }
  }

  return (
    <PageShell fullWidth>
      <DetailPagePattern
        eyebrow="Personen"
        title={fullName}
        headerBadge={
          <Badge variant={person.isActive ? "success" : "default"}>
            {person.isActive ? "Aktiv" : "Inaktiv"}
          </Badge>
        }
        breadcrumbs={[
          { label: "Personen", href: "/dashboard/persons" },
          { label: fullName },
        ]}
        headerActions={
          <div className="flex items-center gap-2">
            {canManage ? (
              <Link
                href={`/dashboard/persons/${person.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-sm font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
              >
                <Pencil className="h-3.5 w-3.5" />
                Bearbeiten
              </Link>
            ) : null}
            {canDelete ? (
              <PersonDeleteButton personId={person.id} personName={fullName} />
            ) : null}
            <Link
              href="/dashboard/persons"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-transparent px-3.5 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Zurück
            </Link>
          </div>
        }
        summary={
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 shadow-sm">
            <AdminAvatar name={fullName} imageSrc={person.imageUrl} size="md" />
            <div className="min-w-0 flex-1">
              {/* Capacity badges */}
              <div className="flex flex-wrap items-center gap-2">
                <StatusIndicator
                  variant={person.isActive ? "success" : "neutral"}
                  label={person.isActive ? "Aktiv" : "Inaktiv"}
                />
                {headerCapacities.map((cap) => (
                  <span
                    key={cap}
                    className="inline-flex items-center rounded-full bg-[var(--sce-accent)] px-2.5 py-1 text-xs font-semibold text-[var(--sce-primary)]"
                  >
                    {cap}
                  </span>
                ))}
              </div>
              {/* Contact info + age */}
              <div className="mt-1.5 flex flex-wrap items-center gap-4 text-sm text-[var(--muted)]">
                {person.dateOfBirth ? (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(person.dateOfBirth)} ({calculateAge(person.dateOfBirth)} J.)
                  </span>
                ) : null}
                {person.email ? (
                  <a
                    href={`mailto:${person.email}`}
                    className="flex items-center gap-1.5 hover:text-[var(--sce-primary)]"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {person.email}
                  </a>
                ) : null}
                {person.phone ? (
                  <a
                    href={`tel:${person.phone}`}
                    className="flex items-center gap-1.5 hover:text-[var(--sce-primary)]"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {person.phone}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        }
        sidebar={
          <>
            {/* Metadata only — AccessRolesCard moved to Zugang tab (PERSON-UX-01) */}
            <MetadataCard
              fields={[
                { label: "Erstellt", value: formatDate(person.createdAt) },
                { label: "Zuletzt geändert", value: formatDate(person.updatedAt) },
              ]}
            />
          </>
        }
      >
        <PersonDetailTabs
          person={{ ...person, assignments, squadMemberships, trainerMemberships }}
          canManage={canManage}
          canDelete={canDelete}
          orgUnits={orgUnits.map((ou) => ({ id: ou.id, name: ou.name }))}
          teams={teams.map((t) => ({ id: t.id, name: t.name, shortName: t.shortName }))}
          activeSeason={activeSeason}
          accessRolesCard={accessRolesCard}
        />
      </DetailPagePattern>
    </PageShell>
  );
}
