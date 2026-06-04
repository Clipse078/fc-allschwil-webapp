import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Hash, Pencil, Target } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTargetGroupById } from "@/lib/org/queries";
import { getDefaultTenant } from "@/lib/tenants/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import TargetGroupForm from "@/components/admin/org/TargetGroupForm";

type PageProps = { params: Promise<{ id: string }> };

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktiv",
  INACTIVE: "Inaktiv",
  ARCHIVED: "Archiviert",
};

function getStatusTone(status: string): "success" | "muted" | "default" {
  if (status === "ACTIVE") return "success";
  return "muted";
}

export default async function TargetGroupDetailPage({ params }: PageProps) {
  await requireAnyPermission([PERMISSIONS.ORG_VIEW, PERMISSIONS.ORG_MANAGE]);
  const { id } = await params;
  const [tg, tenant] = await Promise.all([
    getTargetGroupById(id),
    getDefaultTenant(),
  ]);
  if (!tg) notFound();
  if (tg.tenantId !== null && tenant && tg.tenantId !== tenant.id) notFound();

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="sce-entity-hero">
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/15 backdrop-blur-sm">
              <Target className="h-7 w-7 text-white/90" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                Zielgruppe
              </p>
              <h1
                className="mt-1 text-2xl font-bold text-white"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}
              >
                {tg.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <AdminStatusPill
                  label={STATUS_LABELS[tg.status] ?? tg.status}
                  tone={getStatusTone(tg.status)}
                />
                <code className="rounded border border-white/20 bg-white/10 px-2 py-0.5 text-[0.72rem] font-mono text-white/80">
                  {tg.key}
                </code>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/target-groups"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur-sm transition hover:bg-white/20 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Zurück
            </Link>
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        {/* Main — edit form */}
        <div className="space-y-5">
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Bearbeiten
                </p>
              </div>
            </div>
            <div className="p-5">
              <TargetGroupForm
                mode="edit"
                targetGroupId={tg.id}
                defaultValues={{
                  name: tg.name,
                  key: tg.key,
                  description: tg.description ?? "",
                  status: tg.status,
                }}
              />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Systeminfo
                </p>
              </div>
            </div>
            <div className="sce-detail-section-body space-y-4">
              <div className="sce-data-field">
                <span className="sce-data-label">Key</span>
                <code className="sce-data-value font-mono text-[0.8rem]">{tg.key}</code>
              </div>
              <div className="sce-data-field">
                <span className="sce-data-label">Status</span>
                <AdminStatusPill
                  label={STATUS_LABELS[tg.status] ?? tg.status}
                  tone={getStatusTone(tg.status)}
                />
              </div>
              <div className="sce-data-field">
                <span className="sce-data-label">Erstellt</span>
                <span className="sce-data-value">
                  {new Date(tg.createdAt).toLocaleDateString("de-CH", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="sce-data-field">
                <span className="sce-data-label">Zuletzt geändert</span>
                <span className="sce-data-value">
                  {new Date(tg.updatedAt).toLocaleDateString("de-CH", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>

          {tg.ruleJson ? (
            <div className="sce-detail-section">
              <div className="sce-detail-section-header">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Regel-JSON
                </p>
              </div>
              <div className="sce-detail-section-body">
                <pre className="overflow-x-auto rounded-lg bg-[var(--surface-2)] p-3 text-[11px] font-mono text-[var(--text-2)]">
                  {JSON.stringify(tg.ruleJson, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="sce-detail-section">
              <div className="sce-detail-section-header">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Auflösungsregeln
                </p>
              </div>
              <div className="sce-detail-section-body">
                <p className="text-xs text-[var(--muted)]">
                  Noch keine Regeln definiert. Rule-based resolution kommt in einem späteren Release.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
