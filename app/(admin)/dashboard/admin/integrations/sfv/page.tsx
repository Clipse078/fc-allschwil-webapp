/**
 * Admin → Integrationen → SFV / ClubCorner
 *
 * Displays the SFV integration configuration status and provides a
 * one-click connection test. Slice 1: authentication only; no data import.
 *
 * Permission: TENANTS_MANAGE.
 */

import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { SectionCard } from "@/components/ui/page";
import { getSfvConfigStatus } from "@/lib/integrations/sfv/config";
import SfvConnectionPanel from "@/components/admin/integrations/SfvConnectionPanel";
import { getRuntimeEnvironment } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function SfvIntegrationPage() {
  await requireAnyPermission([PERMISSIONS.TENANTS_MANAGE]);

  const configStatus = getSfvConfigStatus();
  const env = getRuntimeEnvironment();

  const configRows: { label: string; status: "present" | "missing" | "invalid" }[] = [
    {
      label: "SFV_TOKEN_URL",
      status: !configStatus.hasTokenUrl
        ? "missing"
        : !configStatus.tokenUrlUsesHttps
          ? "invalid"
          : "present",
    },
    {
      label: "SFV_APPLICATION_KEY",
      status: configStatus.hasApplicationKey ? "present" : "missing",
    },
    {
      label: "SFV_APPLICATION_PASS",
      status: configStatus.hasApplicationPass ? "present" : "missing",
    },
    {
      label: "SFV_CLUB_ID",
      status: !configStatus.hasClubId
        ? "missing"
        : !configStatus.clubIdFormatValid
          ? "invalid"
          : "present",
    },
  ];

  return (
    <div className="max-w-2xl space-y-8">
      <AdminSectionHeader
        eyebrow="Integrationen"
        title="SFV / ClubCorner"
        description="Schweizerischer Fussballverband — Authentifizierungsstatus und Verbindungstest."
      />

      {/* Scope notice */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <p className="text-sm text-blue-800">
          <strong>Slice 1 — Authentifizierung:</strong> Diese Seite testet ausschliesslich die
          SFV-Verbindung. Es werden keine SFV-Daten importiert, gespeichert oder mit dem
          Spielplan verknüpft.
        </p>
      </div>

      {/* Configuration status */}
      <SectionCard title="Konfiguration" description="Umgebungsvariablen — nur Präsenzstatus">
        <dl className="space-y-3 text-sm">
          {configRows.map((row, idx) => (
            <div
              key={row.label}
              className={`flex justify-between ${idx < configRows.length - 1 ? "border-b border-[var(--border)] pb-3" : ""}`}
            >
              <dt className="font-mono text-xs text-[var(--text-2)]">{row.label}</dt>
              <dd>
                {row.status === "present" && (
                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wide text-emerald-700">
                    Vorhanden
                  </span>
                )}
                {row.status === "missing" && (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wide text-slate-500">
                    Fehlt
                  </span>
                )}
                {row.status === "invalid" && (
                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wide text-amber-700">
                    Ungültig
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-4">
          <span className="text-sm font-medium text-[var(--text-2)]">Gesamtstatus</span>
          {configStatus.allValid ? (
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Vollständig konfiguriert
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700">
              Unvollständig
            </span>
          )}
        </div>
      </SectionCard>

      {/* Environment info */}
      <SectionCard title="SFV-Umgebung">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between border-b border-[var(--border)] pb-3">
            <dt className="font-medium text-[var(--text-2)]">SFV API</dt>
            <dd className="font-semibold uppercase text-[var(--foreground)]">Produktion</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-[var(--text-2)]">App-Umgebung</dt>
            <dd className="font-mono text-xs text-[var(--muted)]">{env.appEnv}</dd>
          </div>
        </dl>
      </SectionCard>

      {/* Connection test */}
      <SectionCard
        title="Verbindungstest"
        description="Testet die SFV-Authentifizierung. Kein Import, keine Datenmutation."
      >
        <SfvConnectionPanel configurationValid={configStatus.allValid} />
      </SectionCard>
    </div>
  );
}
