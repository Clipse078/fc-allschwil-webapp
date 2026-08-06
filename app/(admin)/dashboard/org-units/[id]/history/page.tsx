import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Clock, Users } from "lucide-react";
import { auth } from "@/auth";
import { getOrgUnitById, getOrgUnitMembershipHistory } from "@/lib/org/queries";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { prisma } from "@/lib/db/prisma";
import { getActorContext } from "@/lib/visibility/get-actor-context";
import { canAccessOrgUnit } from "@/lib/visibility/org-unit-access";
import OrgMembershipHistoryView from "@/components/admin/org/OrgMembershipHistoryView";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ seasonId?: string; status?: string }>;
};

export default async function OrgUnitMembershipHistoryPage({ params, searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const { seasonId, status } = await searchParams;

  // Phase 2: org-unit-aware access — same rule as the detail page.
  const actor = await getActorContext(session.user, session.user?.activeTenantId ?? undefined);
  if (!canAccessOrgUnit(id, actor)) {
    redirect("/dashboard");
  }

  const [unit, tenant] = await Promise.all([
    getOrgUnitById(id),
    getActiveTenant(),
  ]);
  if (!unit) notFound();
  if (unit.tenantId !== null && tenant && unit.tenantId !== tenant.id) notFound();

  const [history, seasons] = await Promise.all([
    getOrgUnitMembershipHistory(id, { seasonId, status }),
    prisma.season.findMany({
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, key: true, isActive: true },
    }),
  ]);

  // Ancestor chain for breadcrumb — built using scalar parentId so the logic
  // works regardless of whether the Prisma client includes the parent relation.
  const ancestors: Array<{ id: string; name: string }> = [];
  if (unit.parentId) {
    const parent = await prisma.orgUnit.findUnique({
      where: { id: unit.parentId },
      select: { id: true, name: true, parentId: true },
    });
    if (parent) {
      if (unit.level === 2 && parent.parentId) {
        const grandparent = await prisma.orgUnit.findUnique({
          where: { id: parent.parentId },
          select: { id: true, name: true },
        });
        if (grandparent) ancestors.push(grandparent);
      }
      ancestors.push({ id: parent.id, name: parent.name });
    }
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1 text-sm text-[var(--muted)]">
        <Link href="/dashboard/org-units" className="hover:text-[var(--blue)]">
          Organisationseinheiten
        </Link>
        {ancestors.map((a) => (
          <span key={a.id} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            <Link href={`/dashboard/org-units/${a.id}`} className="hover:text-[var(--blue)]">
              {a.name}
            </Link>
          </span>
        ))}
        <span className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
          <Link href={`/dashboard/org-units/${id}`} className="hover:text-[var(--blue)]">
            {unit.name}
          </Link>
        </span>
        <span className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="font-medium text-[var(--foreground)]">Mitgliedschafts-Verlauf</span>
        </span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-2)]">
            <Clock className="h-5 w-5 text-[var(--muted)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--foreground)]">Mitgliedschafts-Verlauf</h1>
            <p className="text-sm text-[var(--muted)]">{unit.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/org-units/${id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Zurück zur Einheit
          </Link>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
        <Link
          href={`/dashboard/org-units/${id}`}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
        >
          <Users className="h-4 w-4" />
          Aktive Mitglieder
        </Link>
        <span className="flex items-center gap-1.5 rounded-lg bg-[var(--surface-2)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
          <Clock className="h-4 w-4" />
          Verlauf
        </span>
      </div>

      {/* History view with filters */}
      <OrgMembershipHistoryView
        orgUnitId={id}
        history={history}
        seasons={seasons}
        currentSeasonId={seasonId}
        currentStatus={status}
      />
    </div>
  );
}
