import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  FileText,
  Mail,
  Pencil,
  Phone,
  Shield,
  UserCheck,
} from "lucide-react";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getPersonById } from "@/lib/people/queries";
import { getActiveTenantId } from "@/lib/tenants/active-tenant";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { prisma } from "@/lib/db/prisma";
import { TENANT_ROLES_ASSIGN, TENANT_ROLES_VIEW } from "@/lib/roles/access";
import { getTenantRoleAssignmentForUser, getTenantRolesOverview } from "@/lib/roles/tenant-queries";
import PersonRoleBadge from "@/components/admin/shared/PersonRoleBadge";
import PersonAccessRolesCard from "@/components/admin/persons/PersonAccessRolesCard";
import { PageShell, SectionCard } from "@/components/ui/page";
import { DetailPagePattern } from "@/components/ui/patterns";
import { Badge, StatusIndicator } from "@/components/ui";
import { PropertyGrid } from "@/components/ui/PropertyGrid";
import { MetadataCard } from "@/components/ui/MetadataCard";
import { TimelinePlaceholder } from "@/components/ui/TimelinePlaceholder";

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

export default async function PersonDetailPage({ params }: PageProps) {
  const session = await requirePermission(PERMISSIONS.PEOPLE_VIEW);

  const { id } = await params;
  const person = await getPersonById(id);
  if (!person) notFound();

  const fullName =
    person.displayName || `${person.firstName} ${person.lastName}`;
  const initials = getInitials(person.firstName, person.lastName);
  const hasRoles = person.isPlayer || person.isTrainer;

  // ADMIN-MASTERDATA-UX-01 / -C1 — "Zugang & Rollen": null means "don't
  // render the card at all" (caller lacks roles.view/roles.manage for a
  // Person that DOES have a linked User — see PersonAccessRolesCard
  // docstring). A Person with no linked User always renders — either the
  // "Benutzerkonto verknüpfen" picker (canAssign=true) or the static
  // no-account state (canAssign=false), never hidden entirely.
  let accessRolesCard: {
    linkedUser: { id: string; email: string } | null;
    isActiveTenantMember: boolean;
    roles: { id: string; name: string; isSystem: boolean; isArchived: boolean }[];
    assignedRoleIds: string[];
    canAssign: boolean;
  } | null = null;

  if (!person.user) {
    const tenantId = await getActiveTenantId();
    let canAssign = false;
    if (tenantId) {
      const resolver = createEffectivePermissionResolver(prisma);
      const { platform, tenant } = await resolver.getEffectivePermissions({
        userId: session.user.id,
        tenantId,
      });
      canAssign = TENANT_ROLES_ASSIGN.some((key) => platform.includes(key) || tenant.includes(key));
    }

    accessRolesCard = {
      linkedUser: null,
      isActiveTenantMember: false,
      roles: [],
      assignedRoleIds: [],
      canAssign,
    };
  } else {
    const tenantId = await getActiveTenantId();
    if (tenantId) {
      const resolver = createEffectivePermissionResolver(prisma);
      const { platform, tenant } = await resolver.getEffectivePermissions({
        userId: session.user.id,
        tenantId,
      });
      const canView = TENANT_ROLES_VIEW.some((key) => platform.includes(key) || tenant.includes(key));
      const canAssign = TENANT_ROLES_ASSIGN.some((key) => platform.includes(key) || tenant.includes(key));

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
          })),
          assignedRoleIds: assignment?.roleIds ?? [],
          canAssign,
        };
      }
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
            <Link
              href={`/dashboard/persons/${person.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-sm font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <Pencil className="h-3.5 w-3.5" />
              Bearbeiten
            </Link>
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
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3.5 shadow-sm">
            {/* Initials avatar */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--sce-primary-light)] text-sm font-bold text-[var(--sce-primary)]">
              {initials}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-2)]">
              <StatusIndicator
                variant={person.isActive ? "success" : "neutral"}
                label={person.isActive ? "Aktiv" : "Inaktiv"}
              />
              {hasRoles ? (
                <PersonRoleBadge
                  isPlayer={person.isPlayer}
                  isTrainer={person.isTrainer}
                />
              ) : (
                <Badge variant="default" size="sm">
                  Mitglied
                </Badge>
              )}
            </div>
            {person.email ? (
              <a
                href={`mailto:${person.email}`}
                className="ml-auto hidden items-center gap-1.5 text-sm text-[var(--sce-primary)] hover:underline sm:flex"
              >
                <Mail className="h-3.5 w-3.5" />
                {person.email}
              </a>
            ) : null}
          </div>
        }
        sidebar={
          <>
            {/* Contact */}
            <SectionCard title="Kontakt">
              <div className="space-y-3">
                {person.email ? (
                  <div>
                    <p className="text-xs font-medium text-[var(--muted)]">
                      E-Mail
                    </p>
                    <a
                      href={`mailto:${person.email}`}
                      className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-[var(--sce-primary)] hover:underline"
                    >
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      {person.email}
                    </a>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-medium text-[var(--muted)]">
                      E-Mail
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--muted)]">—</p>
                  </div>
                )}
                {person.phone ? (
                  <div>
                    <p className="text-xs font-medium text-[var(--muted)]">
                      Telefon
                    </p>
                    <a
                      href={`tel:${person.phone}`}
                      className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-[var(--sce-primary)] hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      {person.phone}
                    </a>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-medium text-[var(--muted)]">
                      Telefon
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--muted)]">—</p>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Roles */}
            <SectionCard title="Rollen & Status">
              <div className="space-y-2">
                <RoleRow
                  label="Spieler"
                  active={person.isPlayer}
                  icon={<Shield className="h-3.5 w-3.5" />}
                />
                <RoleRow
                  label="Trainer"
                  active={person.isTrainer}
                  icon={<UserCheck className="h-3.5 w-3.5" />}
                />
              </div>
            </SectionCard>

            {/* ADMIN-MASTERDATA-UX-01: Person <-> tenant-role assignment */}
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

            {/* System metadata */}
            <MetadataCard
              fields={[
                { label: "Erstellt", value: formatDate(person.createdAt) },
                {
                  label: "Zuletzt geändert",
                  value: formatDate(person.updatedAt),
                },
              ]}
            />

            <TimelinePlaceholder />
          </>
        }
      >
        {/* Stammdaten */}
        <SectionCard title="Stammdaten">
          <PropertyGrid
            items={[
              { label: "Vorname", value: person.firstName },
              { label: "Nachname", value: person.lastName },
              person.displayName
                ? { label: "Anzeigename", value: person.displayName }
                : { label: "Anzeigename", value: null },
              {
                label: "Geburtsdatum",
                value: person.dateOfBirth ? formatDate(person.dateOfBirth) : null,
                icon: <Calendar className="h-3.5 w-3.5" />,
                emptyText: "Nicht erfasst",
              },
            ]}
            columns={2}
          />
        </SectionCard>

        {/* Notes */}
        <SectionCard
          title="Notizen"
          headerActions={
            <FileText
              className="h-4 w-4 text-[var(--muted)]"
              aria-hidden="true"
            />
          }
        >
          {person.notes ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-2)]">
              {person.notes}
            </p>
          ) : (
            <p className="text-sm italic text-[var(--muted)]">
              Keine Notizen hinterlegt.
            </p>
          )}
        </SectionCard>
      </DetailPagePattern>
    </PageShell>
  );
}

function RoleRow({
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
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium transition ${
        active
          ? "border-[var(--sce-primary-light)] bg-[var(--sce-primary-light)] text-[var(--sce-primary)]"
          : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]"
      }`}
    >
      {icon}
      <span className="flex-1">{label}</span>
      <Badge variant={active ? "primary" : "default"} size="sm">
        {active ? "Ja" : "Nein"}
      </Badge>
    </div>
  );
}
