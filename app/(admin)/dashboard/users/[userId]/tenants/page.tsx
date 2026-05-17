import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  Shield,
  Star,
  UserCircle2,
  XCircle,
} from "lucide-react";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import {
  getUserForTenantPage,
  getUserTenantAssignments,
} from "@/lib/tenants/user-tenant-queries";
import {
  assignUserToTenantAction,
  removeUserFromTenantAction,
  setDefaultTenantAction,
} from "./actions";

// ── Status messages ────────────────────────────────────────────────────────────

const STATUS: Record<string, { text: string; tone: "success" | "warning" }> = {
  "assign-success":          { text: "Tenant assigned successfully.", tone: "success" },
  "assign-missing":          { text: "Required fields missing.", tone: "warning" },
  "assign-user-not-found":   { text: "User not found.", tone: "warning" },
  "assign-tenant-not-found": { text: "Tenant not found.", tone: "warning" },
  "remove-success":          { text: "Tenant access removed.", tone: "success" },
  "remove-last-tenant":      { text: "Cannot remove the user's only active club — assign another first.", tone: "warning" },
  "remove-is-default":       { text: "Cannot remove the default club — set another as default first.", tone: "warning" },
  "remove-protected":        { text: "This assignment is protected and cannot be removed.", tone: "warning" },
  "remove-not-found":        { text: "Assignment not found.", tone: "warning" },
  "default-success":         { text: "Default club updated.", tone: "success" },
  "default-not-assigned":    { text: "User is not assigned to that club.", tone: "warning" },
  "default-inactive":        { text: "Cannot set an inactive assignment as default.", tone: "warning" },
  "default-missing":         { text: "Required fields missing.", tone: "warning" },
};

// ── Props ──────────────────────────────────────────────────────────────────────

type PageProps = {
  params: Promise<{ userId: string }>;
  searchParams?: Promise<{ status?: string }>;
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function UserTenantsPage({ params, searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) redirect("/login");
  if (!(session.user.roleKeys ?? []).includes("super_admin")) redirect("/dashboard");

  const { userId } = await params;
  const user = await getUserForTenantPage(userId);
  if (!user) notFound();

  const resolvedSearch = (await searchParams) ?? {};
  const statusMsg = resolvedSearch.status ? STATUS[resolvedSearch.status] : null;
  const assignments = await getUserTenantAssignments(userId);

  const assignedCount = assignments.filter((a) => a.assigned).length;

  return (
    <div className="space-y-7">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <AdminSectionHeader
        eyebrow="Platform · User Management"
        title="Tenant Access"
        description="Control which clubs this user can access inside SportClubEvo."
        actions={
          <Link href={`/dashboard/users/${userId}`} className="fca-button-secondary">
            ← Back to User
          </Link>
        }
      />

      {/* ── User chip ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5 rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-[#0b4aa2]">
            <UserCircle2 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5">
          <Building2 className="h-3.5 w-3.5 text-indigo-500" />
          <span className="text-xs font-semibold text-indigo-700">
            {assignedCount} {assignedCount === 1 ? "club assigned" : "clubs assigned"}
          </span>
        </div>
      </div>

      {/* ── Nudge ──────────────────────────────────────────────────────── */}
      <div className="rounded-[20px] border border-blue-100 bg-blue-50/60 px-5 py-4">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Tenant access controls which clubs a user can enter inside SportClubEvo.</span>{" "}
            The <span className="font-semibold">Default</span> club is used on first login and when no active tenant is selected.
            Setting a user as <span className="font-semibold">inactive</span> on a tenant revokes access without deleting the record.
          </p>
        </div>
      </div>

      {/* ── Status banner ──────────────────────────────────────────────── */}
      {statusMsg ? (
        <div
          className={`rounded-[18px] border px-5 py-3.5 text-sm font-medium ${
            statusMsg.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {statusMsg.text}
        </div>
      ) : null}

      {/* ── Assignment table ───────────────────────────────────────────── */}
      <AdminSurfaceCard className="overflow-hidden p-0">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Club / Tenant</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Role</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Status</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Default</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Actions</p>
        </div>

        {assignments.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-slate-500">No tenants found in the platform.</p>
          </div>
        ) : null}

        <ul className="divide-y divide-slate-100/80">
          {assignments.map((row) => (
            <li key={row.tenantId} className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 px-6 py-4">

              {/* Club info */}
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 shadow-sm"
                  style={row.primaryColor ? { borderColor: `${row.primaryColor}30`, backgroundColor: `${row.primaryColor}08`, color: row.primaryColor } : undefined}
                >
                  <Building2 className="h-4 w-4 text-slate-400" style={row.primaryColor ? { color: row.primaryColor } : undefined} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {row.tenantName}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
                      {row.tenantSlug}
                    </code>
                    {!row.tenantIsActive ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                        Inactive tenant
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Role */}
              <div className="w-24">
                {row.assigned ? (
                  <span className="inline-block rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    {row.role ?? "member"}
                  </span>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
              </div>

              {/* Status badge */}
              <div className="w-24">
                {row.assigned ? (
                  row.userTenantIsActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      Assigned
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                      <XCircle className="h-3 w-3" />
                      Inactive
                    </span>
                  )
                ) : (
                  <span className="inline-block rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-400">
                    Not assigned
                  </span>
                )}
              </div>

              {/* Default badge */}
              <div className="w-20 text-center">
                {row.isDefault ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    Default
                  </span>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2">
                {!row.assigned || !row.userTenantIsActive ? (
                  /* Assign */
                  <form action={assignUserToTenantAction}>
                    <input type="hidden" name="userId" value={userId} />
                    <input type="hidden" name="tenantId" value={row.tenantId} />
                    <input type="hidden" name="role" value="member" />
                    <button
                      type="submit"
                      className="rounded-full border border-[#0b4aa2]/20 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#0b4aa2] shadow-sm transition hover:bg-[#0b4aa2]/5"
                    >
                      Assign
                    </button>
                  </form>
                ) : (
                  <>
                    {/* Set as default */}
                    {!row.isDefault ? (
                      <form action={setDefaultTenantAction}>
                        <input type="hidden" name="userId" value={userId} />
                        <input type="hidden" name="tenantId" value={row.tenantId} />
                        <button
                          type="submit"
                          className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700 shadow-sm transition hover:bg-amber-100"
                        >
                          Set default
                        </button>
                      </form>
                    ) : null}

                    {/* Remove */}
                    <form action={removeUserFromTenantAction}>
                      <input type="hidden" name="userId" value={userId} />
                      <input type="hidden" name="tenantId" value={row.tenantId} />
                      <button
                        type="submit"
                        className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100"
                      >
                        Remove
                      </button>
                    </form>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </AdminSurfaceCard>

      {/* ── Quick-assign with role selector ────────────────────────────── */}
      <AdminSurfaceCard className="p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Assign with custom role</h3>
        <form action={assignUserToTenantAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="userId" value={userId} />

          <div className="flex-1 min-w-[160px]">
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Club / Tenant
            </label>
            <select
              name="tenantId"
              required
              className="w-full rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/10"
            >
              <option value="">Select a club…</option>
              {assignments.map((a) => (
                <option key={a.tenantId} value={a.tenantId}>
                  {a.tenantName} ({a.tenantSlug})
                </option>
              ))}
            </select>
          </div>

          <div className="w-36">
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Role
            </label>
            <select
              name="role"
              className="w-full rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/10"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          <button type="submit" className="fca-button-primary">
            Assign
          </button>
        </form>
      </AdminSurfaceCard>
    </div>
  );
}
