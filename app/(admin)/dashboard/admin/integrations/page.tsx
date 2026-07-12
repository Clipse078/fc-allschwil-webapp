/**
 * Admin → Integrationen overview page.
 *
 * Lists configured external integrations and their status at a glance.
 * Permission: TENANTS_MANAGE.
 */

import Link from "next/link";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { SectionCard } from "@/components/ui/page";
import { getSfvConfigStatus } from "@/lib/integrations/sfv/config";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  await requireAnyPermission([PERMISSIONS.TENANTS_MANAGE]);

  const sfvStatus = getSfvConfigStatus();

  return (
    <div className="max-w-2xl space-y-8">
      <AdminSectionHeader
        eyebrow="Admin"
        title="Integrationen"
        description="Externe Datenquellen und Verbindungen verwalten."
      />

      <SectionCard
        title="SFV / ClubCorner"
        description="Schweizerischer Fussballverband — offizielle Spiel- und Turnierdaten"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-2)]">Status</span>
            {sfvStatus.allValid ? (
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Konfiguriert
              </span>
            ) : sfvStatus.allPresent ? (
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                Konfiguration ungültig
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Nicht konfiguriert
              </span>
            )}
          </div>

          <p className="text-xs text-[var(--text-2)] leading-relaxed">
            Slice 1: Authentifizierung und Verbindungstest. Keine SFV-Daten werden in dieser
            Version importiert oder geschrieben.
          </p>

          <div className="pt-1">
            <Link
              href="/dashboard/admin/integrations/sfv"
              className="inline-flex h-9 items-center rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 text-sm font-semibold text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              Details &rarr;
            </Link>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
