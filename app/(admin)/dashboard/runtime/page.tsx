import { evaluateRuntimeConfiguration } from "@/lib/server/runtime";
import { getDeploymentMetadata } from "@/lib/server/deployment";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export const dynamic = "force-dynamic";

export default async function DashboardRuntimePage() {
  await requirePermission(PERMISSIONS.USERS_MANAGE);

  const runtime = evaluateRuntimeConfiguration();
  const deployment = getDeploymentMetadata();

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-xl lg:p-7">
        <p className="fca-eyebrow">Deployment Diagnostics</p>
        <h2 className="mt-2 font-[var(--font-display)] text-[2rem] font-bold uppercase tracking-[-0.04em] text-[#0b4aa2] lg:text-[2.35rem]">
          Runtime & Deployment
        </h2>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-red-600">
          Deployment
        </div>

        <dl className="space-y-3 text-sm text-slate-700">
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

      <section className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-red-600">
          Runtime Status
        </div>

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
