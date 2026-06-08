import { evaluateRuntimeConfiguration } from "@/lib/server/runtime";
import { getDeploymentMetadata } from "@/lib/server/deployment";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";

export const dynamic = "force-dynamic";

export default async function DashboardRuntimePage() {
  await requirePermission(PERMISSIONS.USERS_MANAGE);

  const runtime = evaluateRuntimeConfiguration();
  const deployment = getDeploymentMetadata();

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Deployment Diagnostics"
        title="Runtime & Deployment"
      />

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <p className="fca-eyebrow mb-3">Deployment</p>

        <dl className="space-y-3 text-sm text-[var(--text-2)]">
          <div className="flex justify-between">
            <dt>Environment</dt>
            <dd>{deployment.environment}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Vercel Env</dt>
            <dd>{deployment.vercelEnv ?? "not set"}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Commit</dt>
            <dd>{deployment.commitSha ?? "not available"}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Deployment ID</dt>
            <dd>{deployment.deploymentId ?? "not available"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <p className="fca-eyebrow mb-3">Runtime Status</p>

        <div
          className={
            runtime.ok
              ? "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700"
              : "inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-semibold text-red-700"
          }
        >
          {runtime.ok ? "Healthy" : "Action required"}
        </div>
      </section>
    </div>
  );
}
