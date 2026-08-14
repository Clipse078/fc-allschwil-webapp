import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, ArrowLeft, Mail, Phone } from "lucide-react";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getPersonById, getPersonAssignments, getOrgUnitsForTenant, getTeamsForTenant, getActiveSeasonForTenant } from "@/lib/people/queries";
import { getActiveTenantId } from "@/lib/tenants/active-tenant";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { prisma } from "@/lib/db/prisma";
import { PageShell, SectionCard } from "@/components/ui/page";
import { DetailPagePattern } from "@/components/ui/patterns";
import { Badge, StatusIndicator } from "@/components/ui";
import { MetadataCard } from "@/components/ui/MetadataCard";
import AdminAvatar from "@/components/admin/shared/AdminAvatar";
import PersonDetailTabs from "@/components/admin/persons/PersonDetailTabs";
import PersonDeleteButton from "@/components/admin/persons/PersonDeleteButton";
import PersonAccessRolesCard from "@/components/admin/persons/PersonAccessRolesCard";
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

  const [assignments, orgUnits, teams, activeSeason] = await Promise.all([
    getPersonAssignments(id),
    tenantId ? getOrgUnitsForTenant(tenantId) : Promise.resolve([]),
    tenantId ? getTeamsForTenant(tenantId) : Promise.resolve([]),
    tenantId ? getActiveSeasonForTenant(tenantId) : Promise.resolve(null),
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

  // Active functions summary for header
  const activeFunctions = [
    ...new Set(
      assignments
        .filter((a) => a.status === "ACTIVE" && a.roleKey)
        .map((a) => getPersonFunctionLabel(a.roleKey)),
    ),
  ].slice(0, 3);

  // AccessRolesCard logic (from original)
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
              <div className="flex flex-wrap items-center gap-2">
                <StatusIndicator
                  variant={person.isActive ? "success" : "neutral"}
                  label={person.isActive ? "Aktiv" : "Inaktiv"}
                />
                {activeFunctions.map((fn) => (
                  <span
                    key={fn}
                    className="inline-flex items-center rounded-full bg-[var(--sce-accent)] px-2.5 py-1 text-xs font-semibold text-[var(--sce-primary)]"
                  >
                    {fn}
                  </span>
                ))}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-4 text-sm text-[var(--muted)]">
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
            {/* Access Roles */}
            {accessRolesCard ? (
              <SectionCard title="Zugang & Rollen">
                <PersonAccessRolesCard
                  personId={person.id}
                  linkedUser={accessRolesCard.linkedUser}
                  isActiveTenantMember={accessRolesCard.isActiveTenantMember}
                  roles={accessRolesCard.roles}
                  assignedRoleIds={accessRolesCard.assignedRoleIds}
                  canAssign={accessRolesCard.canAssign}
                />
              </SectionCard>
            ) : null}

            {/* Metadata */}
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
          person={{ ...person, assignments }}
          canManage={canManage}
          canDelete={canDelete}
          orgUnits={orgUnits.map((ou) => ({ id: ou.id, name: ou.name }))}
          teams={teams.map((t) => ({ id: t.id, name: t.name, shortName: t.shortName }))}
          activeSeason={activeSeason}
        />
      </DetailPagePattern>
    </PageShell>
  );
}
