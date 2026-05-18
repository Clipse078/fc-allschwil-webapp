import { evaluateRuntimeConfiguration } from "@/lib/server/runtime";
import { getDeploymentMetadata } from "@/lib/server/deployment";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import PageShell from "@/components/shared/ui/PageShell";
import SectionCard from "@/components/shared/ui/SectionCard";
import StatusBadge from "@/components/shared/ui/StatusBadge";

export const dynamic = "force-dynamic";

export default async function DashboardRuntimePage() {
  await requirePermission(PERMISSIONS.USERS_MANAGE);

  const runtime = evaluateRuntimeConfiguration();
  const deployment = getDeploymentMetadata();

  return (
    <PageShell>
      <SectionCard className="p-6 lg:p-8">
        <div className="mb-1">
          <p className="fca-eyebrow">Deployment</p>
        </div>

        <dl className="mt-4 space-y-3 text-sm text-slate-700">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <dt className="font-medium text-slate-500">Environment</dt>
            <dd className="font-semibold text-slate-900">{deployment.environment}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <dt className="font-medium text-slate-500">Vercel Env</dt>
            <dd className="font-semibold text-slate-900">{deployment.vercelEnv ?? "not set"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <dt className="font-medium text-slate-500">Commit</dt>
            <dd className="font-mono text-xs text-slate-700">{deployment.commitSha ?? "not available"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="font-medium text-slate-500">Deployment ID</dt>
            <dd className="font-mono text-xs text-slate-700">{deployment.deploymentId ?? "not available"}</dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard className="p-6 lg:p-8">
        <div className="mb-4">
          <p className="fca-eyebrow">Runtime Status</p>
        </div>

        <div className="flex items-center gap-4">
          <StatusBadge
            label={runtime.ok ? "Healthy" : "Action required"}
            tone={runtime.ok ? "success" : "danger"}
          />

          {!runtime.ok ? (
            <p className="text-sm text-slate-600">
              Runtime-Konfiguration ist unvollständig. Bitte Umgebungsvariablen prüfen.
            </p>
          ) : null}
        </div>
      </SectionCard>
    </PageShell>
  );
}
