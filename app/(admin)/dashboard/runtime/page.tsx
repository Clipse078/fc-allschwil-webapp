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
      <section className="sce-card p-6 backdrop-blur-xl lg:p-7">
        <p className="sce-eyebrow">Deployment Diagnostics</p>
        <h2 className="mt-2 font-[var(--font-display)] text-[2rem] font-bold uppercase tracking-[-0.04em] text-[var(--sce-heading)] lg:text-[2.35rem]">
          Runtime &amp; Deployment
        </h2>
        {deployment.isPreview ? (
          <div className="mt-4 rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Preview Deployment — env vars may be incomplete. Use the STAGE Production deployment as canonical.
          </div>
        ) : null}
      </section>

      <section className="rounded-[28px] border border-[var(--sce-border)] bg-[var(--sce-surface)] p-8 shadow-sm">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sce-accent)]">
          Deployment
        </div>

        <dl className="space-y-3 text-sm text-[var(--sce-text)]">
          <div className="flex justify-between">
            <dt className="text-[var(--sce-muted)]">Environment</dt>
            <dd className="font-medium">{deployment.environment}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--sce-muted)]">Vercel Env</dt>
            <dd className="font-medium">{deployment.vercelEnv ?? "not set"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--sce-muted)]">Preview</dt>
            <dd className="font-medium">{deployment.isPreview ? "YES — not canonical" : "No"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--sce-muted)]">Branch</dt>
            <dd className="font-medium">{deployment.branch ?? "not available"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--sce-muted)]">Commit</dt>
            <dd className="font-mono text-xs">{deployment.commitSha ?? "not available"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--sce-muted)]">Deployment URL</dt>
            <dd className="font-mono text-xs">{deployment.deploymentUrl ?? "not available"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--sce-muted)]">Deployment ID</dt>
            <dd className="font-mono text-xs">{deployment.deploymentId ?? "not available"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-[28px] border border-[var(--sce-border)] bg-[var(--sce-surface)] p-8 shadow-sm">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sce-accent)]">
          Environment Variables
        </div>

        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-[var(--sce-muted)]">APP_ENV</dt>
            <dd className="font-medium">{runtime.env.appEnv}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--sce-muted)]">NODE_ENV</dt>
            <dd className="font-medium">{runtime.env.nodeEnv}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--sce-muted)]">DATABASE_URL</dt>
            <dd className={runtime.env.hasDatabaseUrl ? "font-medium text-emerald-600" : "font-medium text-red-600"}>
              {runtime.env.hasDatabaseUrl ? "present" : "MISSING"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--sce-muted)]">AUTH_SECRET</dt>
            <dd className={runtime.env.hasAuthSecret ? "font-medium text-emerald-600" : "font-medium text-amber-600"}>
              {runtime.env.hasAuthSecret ? "present" : "not set (check NEXTAUTH_SECRET)"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--sce-muted)]">AUTH_SECRET or NEXTAUTH_SECRET</dt>
            <dd className={runtime.env.hasNextAuthSecret ? "font-medium text-emerald-600" : "font-medium text-red-600"}>
              {runtime.env.hasNextAuthSecret ? "present" : "MISSING"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--sce-muted)]">NEXTAUTH_URL</dt>
            <dd className={runtime.env.nextAuthUrl ? "font-medium text-emerald-600" : "font-medium text-amber-600"}>
              {runtime.env.nextAuthUrl ?? "not set"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-[28px] border border-[var(--sce-border)] bg-[var(--sce-surface)] p-8 shadow-sm">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sce-accent)]">
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

        {runtime.errors.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {runtime.errors.map((error) => (
              <li key={error} className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
                {error}
              </li>
            ))}
          </ul>
        ) : null}

        {runtime.warnings.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {runtime.warnings.map((warning) => (
              <li key={warning} className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                {warning}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-[28px] border border-[var(--sce-border)] bg-[var(--sce-surface)] p-6 shadow-sm">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sce-muted)]">
          First Debug Step
        </div>
        <p className="text-sm text-[var(--sce-muted)]">
          Check <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">/api/health</code> for machine-readable JSON of all checks, warnings, and database connectivity.
        </p>
      </section>
    </div>
  );
}
