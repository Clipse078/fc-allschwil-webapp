import { evaluateRuntimeConfiguration } from "@/lib/server/runtime";
import { getDeploymentMetadata } from "@/lib/server/deployment";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { SectionCard } from "@/components/ui/page";

export const dynamic = "force-dynamic";

export default async function DashboardRuntimePage() {
  await requirePermission(PERMISSIONS.USERS_MANAGE);

  const runtime = evaluateRuntimeConfiguration();
  const deployment = getDeploymentMetadata();

  return (
    <div className="space-y-6 max-w-2xl">
      <AdminSectionHeader
        eyebrow="System"
        title="Runtime & Deployment"
        description="Deployment-Konfiguration, Umgebungsvariablen und Systemstatus auf einen Blick."
      />

      <SectionCard title="Deployment" description="Aktive Konfiguration und Build-Informationen">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between border-b border-[var(--border)] pb-3">
            <dt className="font-medium text-[var(--text-2)]">Environment</dt>
            <dd className="font-semibold text-[var(--foreground)]">{deployment.environment}</dd>
          </div>
          <div className="flex justify-between border-b border-[var(--border)] pb-3">
            <dt className="font-medium text-[var(--text-2)]">Vercel Env</dt>
            <dd className="font-mono text-xs text-[var(--muted)]">{deployment.vercelEnv ?? "not set"}</dd>
          </div>
          <div className="flex justify-between border-b border-[var(--border)] pb-3">
            <dt className="font-medium text-[var(--text-2)]">Commit</dt>
            <dd className="font-mono text-xs text-[var(--muted)]">{deployment.commitSha ?? "not available"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-[var(--text-2)]">Deployment ID</dt>
            <dd className="font-mono text-xs text-[var(--muted)]">{deployment.deploymentId ?? "not available"}</dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard title="Runtime Status" description="Systemgesundheit und Konfigurationsstatus">
        <div className="flex items-center gap-3">
          <div
            className={
              runtime.ok
                ? "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700"
                : "inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-semibold text-red-700"
            }
          >
            {runtime.ok ? "Healthy" : "Action required"}
          </div>
          <span className="text-sm text-[var(--muted)]">
            {runtime.ok
              ? "Alle Systemkonfigurationen sind valide."
              : "Konfigurationsfehler erkannt — Details in den Server-Logs."}
          </span>
        </div>
      </SectionCard>
    </div>
  );
}
