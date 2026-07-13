"use client";

/**
 * SfvTenantConfigPanel
 *
 * Full-page client component for the SFV integration tenant configuration.
 *
 * Responsibilities:
 *   - Display and edit tenant-scoped SFV configuration (clubId, defaultSeasonId,
 *     organisationId, enabled) via GET|POST /api/admin/integrations/sfv/config.
 *   - Show connection status (Configured / Not Configured) from loaded config.
 *   - Run diagnostics via POST /api/admin/integrations/sfv/diagnostics and
 *     render the full SfvAdminDiagnostics response.
 *   - Run team synchronization via POST /api/admin/integrations/sfv/teams/sync
 *     and render the typed SfvTeamSyncResult summary.
 *
 * Data flow:
 *   - initialConfig from server (SSR) populates the form on first render.
 *   - Save → POST → reload config into form state.
 *   - Run Diagnostics → POST → display diagnostics result inline.
 *   - Teams synchronisieren → POST → display sync result inline.
 *
 * Security:
 *   - No Prisma. No repository layer. API only.
 *   - tenantId is resolved server-side; never submitted in the request body.
 *   - No credentials, tokens, raw provider payloads, or stack traces are rendered.
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/page";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { useToast } from "@/hooks/use-toast";
import type { TenantSfvConfig } from "@/lib/integrations/sfv/tenant-config-types";
import type { SfvAdminDiagnostics, SfvDiagnosticIssue } from "@/lib/integrations/sfv/admin-diagnostics-service";
import type { SfvTeamSyncResult } from "@/lib/integrations/sfv/sync/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type FormValues = {
  clubId: string;
  defaultSeasonId: string;
  organisationId: string;
  enabled: boolean;
};

type FieldErrors = Partial<Record<keyof FormValues, string>>;

type DiagnosticsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: SfvAdminDiagnostics }
  | { status: "error"; message: string };

type TeamSyncState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: SfvTeamSyncResult }
  | { status: "error"; message: string };

type SfvTenantConfigPanelProps = {
  initialConfig: TenantSfvConfig | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function configToForm(config: TenantSfvConfig | null): FormValues {
  if (!config) {
    return { clubId: "", defaultSeasonId: "", organisationId: "", enabled: true };
  }
  return {
    clubId: String(config.clubId),
    defaultSeasonId: String(config.defaultSeasonId),
    organisationId: config.organisationId != null ? String(config.organisationId) : "",
    enabled: config.enabled,
  };
}

function parsePositiveInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function validateForm(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};

  if (!values.clubId.trim()) {
    errors.clubId = "Club ID ist erforderlich.";
  } else if (parsePositiveInt(values.clubId) === null) {
    errors.clubId = "Club ID muss eine positive ganze Zahl sein (z.B. 483).";
  }

  if (!values.defaultSeasonId.trim()) {
    errors.defaultSeasonId = "Standard-Saison ist erforderlich.";
  } else if (parsePositiveInt(values.defaultSeasonId) === null) {
    errors.defaultSeasonId = "Saison muss eine positive ganze Zahl sein (z.B. 2027).";
  }

  if (values.organisationId.trim() !== "" && parsePositiveInt(values.organisationId) === null) {
    errors.organisationId = "Organisation-ID muss eine positive ganze Zahl sein oder leer gelassen werden.";
  }

  return errors;
}

// ── Health display helpers ────────────────────────────────────────────────────

function healthVariant(health: SfvAdminDiagnostics["health"]) {
  switch (health) {
    case "healthy":   return "success" as const;
    case "degraded":  return "warning" as const;
    case "unhealthy": return "danger" as const;
  }
}

function healthLabel(health: SfvAdminDiagnostics["health"]) {
  switch (health) {
    case "healthy":   return "Gesund";
    case "degraded":  return "Beeinträchtigt";
    case "unhealthy": return "Fehlerhaft";
  }
}

function issueVariant(issue: SfvDiagnosticIssue) {
  switch (issue.severity) {
    case "error":   return "danger" as const;
    case "warning": return "warning" as const;
    case "info":    return "info" as const;
  }
}

// ── Sub-component: Diagnostics Result ────────────────────────────────────────

function DiagnosticsResult({ data }: { data: SfvAdminDiagnostics }) {
  const counts = data.counts;

  return (
    <div className="space-y-5" data-testid="diagnostics-result">
      {/* Health + meta */}
      <div className="flex flex-wrap items-center gap-4">
        <StatusIndicator
          variant={healthVariant(data.health)}
          label={healthLabel(data.health)}
          data-testid="diagnostics-health"
        />
        <span className="text-xs text-[var(--muted)]">
          {data.seasonName ?? `Saison ${data.seasonId}`}
          {data.seasonShortName ? ` (${data.seasonShortName})` : ""}
        </span>
        <span className="text-xs text-[var(--muted)]">
          {data.totalDurationMs} ms
        </span>
      </div>

      {/* Counts grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        {[
          { label: "Eigene Teams", value: counts.ownTeams },
          { label: "Spielplan-Einträge", value: counts.scheduleRows },
          { label: "Ranglisten-Einträge", value: counts.rankingRows },
          { label: "Konfigurierter Club", value: data.clubId },
          { label: "Konfigurierte Saison", value: data.seasonId },
          { label: "Bilder vorhanden", value: counts.picturesPresent },
          { label: "Bilder fehlend (204)", value: counts.picturesMissing },
          { label: "Bild-Fehler", value: counts.pictureFailures },
          { label: "Gegner-Teams", value: counts.uniqueOpponentTeams },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between gap-2 border-b border-[var(--border)] py-1.5">
            <span className="text-[var(--text-2)]">{label}</span>
            <span className="font-semibold text-[var(--foreground)]">{value}</span>
          </div>
        ))}
      </div>

      {/* Issues */}
      {data.issues.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Probleme ({data.issues.length})
          </p>
          <ul className="space-y-2" data-testid="diagnostics-issues">
            {data.issues.map((issue) => (
              <li
                key={issue.code}
                className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2"
              >
                <StatusIndicator variant={issueVariant(issue)} size="sm" className="mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--text-2)]">
                    {issue.code}
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--foreground)]">{issue.message}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.issues.length === 0 && (
        <p className="text-sm text-[var(--sce-success)]">
          Keine Probleme gefunden.
        </p>
      )}
    </div>
  );
}

// ── Sub-component: Team Sync Result ──────────────────────────────────────────

function TeamSyncResult({ data }: { data: SfvTeamSyncResult }) {
  const hasErrors = data.errors.length > 0;

  const rows: { label: string; value: number | string }[] = [
    { label: "Abgerufen", value: data.fetched },
    { label: "Neu erstellt", value: data.created },
    { label: "Aktualisiert", value: data.updated },
    { label: "Unverändert", value: data.unchanged },
    { label: "Inaktiv markiert", value: data.markedInactive },
    { label: "Fehler", value: data.failed },
    { label: "Dauer", value: `${data.durationMs} ms` },
  ];

  return (
    <div className="space-y-4" data-testid="team-sync-result">
      <div className="flex flex-wrap items-center gap-3">
        <StatusIndicator
          variant={hasErrors ? (data.created + data.updated + data.unchanged > 0 ? "warning" : "danger") : "success"}
          label={hasErrors ? "Abgeschlossen (mit Fehlern)" : "Erfolgreich abgeschlossen"}
          data-testid="team-sync-status"
        />
        <span className="text-xs text-[var(--muted)]">
          Saison {data.seasonId} · Club {data.clubId}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        {rows.map(({ label, value }) => (
          <div
            key={label}
            className="flex justify-between gap-2 border-b border-[var(--border)] py-1.5"
          >
            <span className="text-[var(--text-2)]">{label}</span>
            <span className="font-semibold text-[var(--foreground)]">{value}</span>
          </div>
        ))}
      </div>

      {hasErrors && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Fehlerdetails ({data.errors.length})
          </p>
          <ul className="space-y-1.5" data-testid="team-sync-errors">
            {data.errors.map((err, idx) => (
              <li
                key={`${err.code}-${idx}`}
                className="flex items-start gap-2 rounded-lg border border-[var(--sce-danger-border)] bg-[var(--sce-danger-light)] px-3 py-2"
              >
                <StatusIndicator variant="danger" size="sm" className="mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--text-2)]">
                    {err.code}
                    {err.externalTeamId !== undefined ? ` · Team ${err.externalTeamId}` : ""}
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--foreground)]">{err.message}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SfvTenantConfigPanel({ initialConfig }: SfvTenantConfigPanelProps) {
  const { toast } = useToast();

  const [config, setConfig] = useState<TenantSfvConfig | null>(initialConfig);
  const [form, setForm] = useState<FormValues>(() => configToForm(initialConfig));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsState>({ status: "idle" });
  const [teamSync, setTeamSync] = useState<TeamSyncState>({ status: "idle" });

  // ── Field change handlers ──────────────────────────────────────────────────

  function handleChange(field: keyof FormValues, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
    }
  }

  // ── Save configuration ────────────────────────────────────────────────────

  const handleSave = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    const fieldErrors = validateForm(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    try {
      const body = {
        clubId: parsePositiveInt(form.clubId)!,
        defaultSeasonId: parsePositiveInt(form.defaultSeasonId)!,
        organisationId: form.organisationId.trim() ? parsePositiveInt(form.organisationId) : null,
        enabled: form.enabled,
      };

      const res = await fetch("/api/admin/integrations/sfv/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({})) as { config?: TenantSfvConfig; error?: string; field?: string };

      if (!res.ok) {
        if (data.field) {
          setErrors({ [data.field as keyof FormValues]: data.error ?? "Ungültiger Wert." });
        }
        toast.danger(data.error ?? "Fehler beim Speichern.");
        return;
      }

      if (data.config) {
        setConfig(data.config);
        setForm(configToForm(data.config));
      }

      toast.success("Konfiguration gespeichert.");
    } catch {
      toast.danger("Netzwerkfehler. Bitte Seite neu laden.");
    } finally {
      setSaving(false);
    }
  }, [form, toast]);

  // ── Run diagnostics ───────────────────────────────────────────────────────

  const handleRunDiagnostics = useCallback(async () => {
    setDiagnostics({ status: "loading" });
    try {
      const res = await fetch("/api/admin/integrations/sfv/diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json().catch(() => ({})) as { diagnostics?: SfvAdminDiagnostics; error?: string };

      if (res.status === 404) {
        setDiagnostics({ status: "error", message: "Keine SFV-Konfiguration gefunden. Bitte zuerst speichern." });
        return;
      }
      if (res.status === 409) {
        setDiagnostics({ status: "error", message: "SFV-Integration ist deaktiviert." });
        return;
      }

      if (!data.diagnostics) {
        setDiagnostics({ status: "error", message: data.error ?? "Unbekannter Fehler bei der Diagnose." });
        return;
      }

      setDiagnostics({ status: "success", data: data.diagnostics });
    } catch {
      setDiagnostics({ status: "error", message: "Netzwerkfehler. Bitte Seite neu laden." });
    }
  }, []);

  // ── Team synchronization ──────────────────────────────────────────────────

  const handleTeamSync = useCallback(async () => {
    setTeamSync({ status: "loading" });
    try {
      const res = await fetch("/api/admin/integrations/sfv/teams/sync", {
        method: "POST",
      });

      const data = await res.json().catch(() => ({})) as {
        result?: SfvTeamSyncResult;
        error?: string;
      };

      if (res.status === 404) {
        setTeamSync({
          status: "error",
          message: "Keine SFV-Konfiguration gefunden. Bitte zuerst speichern.",
        });
        return;
      }
      if (res.status === 409) {
        setTeamSync({
          status: "error",
          message: "SFV-Integration ist deaktiviert.",
        });
        return;
      }

      if (!res.ok || !data.result) {
        setTeamSync({
          status: "error",
          message: data.error ?? "Unbekannter Fehler bei der Synchronisierung.",
        });
        return;
      }

      setTeamSync({ status: "success", data: data.result });
    } catch {
      setTeamSync({
        status: "error",
        message: "Netzwerkfehler. Bitte Seite neu laden.",
      });
    }
  }, []);

  // ── Connection status ─────────────────────────────────────────────────────

  const isConfigured = config !== null && config.enabled;

  // ── Render ────────────────────────────────────────────────────────────────

  const inputClass =
    "w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted)] outline-none transition focus:border-[var(--sce-primary)] focus:ring-1 focus:ring-[var(--sce-primary)] disabled:opacity-50";

  const labelClass =
    "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5";

  return (
    <div className="space-y-6">
      {/* ── Configuration form ─────────────────────────────────────────────── */}
      <SectionCard
        title="Konfiguration"
        description="SFV-Verbindungsparameter für diesen Mandanten konfigurieren."
      >
        <form onSubmit={handleSave} noValidate className="space-y-5" data-testid="sfv-config-form">
          {/* Club ID */}
          <div>
            <label htmlFor="sfv-club-id" className={labelClass}>
              Club ID
            </label>
            <input
              id="sfv-club-id"
              type="number"
              min={1}
              step={1}
              value={form.clubId}
              onChange={(e) => handleChange("clubId", e.target.value)}
              placeholder="z.B. 483"
              disabled={saving}
              aria-describedby={errors.clubId ? "sfv-club-id-error" : undefined}
              aria-invalid={!!errors.clubId}
              className={inputClass}
              data-testid="input-club-id"
            />
            {errors.clubId && (
              <p id="sfv-club-id-error" role="alert" className="mt-1 text-[11px] font-medium text-[var(--sce-danger)]" data-testid="error-club-id">
                {errors.clubId}
              </p>
            )}
          </div>

          {/* Default Season ID */}
          <div>
            <label htmlFor="sfv-season-id" className={labelClass}>
              Standard-Saison
            </label>
            <input
              id="sfv-season-id"
              type="number"
              min={1}
              step={1}
              value={form.defaultSeasonId}
              onChange={(e) => handleChange("defaultSeasonId", e.target.value)}
              placeholder="z.B. 2027"
              disabled={saving}
              aria-describedby={errors.defaultSeasonId ? "sfv-season-id-error" : undefined}
              aria-invalid={!!errors.defaultSeasonId}
              className={inputClass}
              data-testid="input-season-id"
            />
            {errors.defaultSeasonId && (
              <p id="sfv-season-id-error" role="alert" className="mt-1 text-[11px] font-medium text-[var(--sce-danger)]" data-testid="error-season-id">
                {errors.defaultSeasonId}
              </p>
            )}
          </div>

          {/* Organisation ID (optional) */}
          <div>
            <label htmlFor="sfv-org-id" className={labelClass}>
              Organisation ID{" "}
              <span className="font-normal normal-case tracking-normal text-[var(--muted)]">(optional)</span>
            </label>
            <input
              id="sfv-org-id"
              type="number"
              min={1}
              step={1}
              value={form.organisationId}
              onChange={(e) => handleChange("organisationId", e.target.value)}
              placeholder="Leer lassen wenn nicht vorhanden"
              disabled={saving}
              aria-describedby={errors.organisationId ? "sfv-org-id-error" : undefined}
              aria-invalid={!!errors.organisationId}
              className={inputClass}
              data-testid="input-org-id"
            />
            {errors.organisationId && (
              <p id="sfv-org-id-error" role="alert" className="mt-1 text-[11px] font-medium text-[var(--sce-danger)]" data-testid="error-org-id">
                {errors.organisationId}
              </p>
            )}
          </div>

          {/* Enabled toggle */}
          <div>
            <p className={labelClass}>Integration aktiviert</p>
            <button
              type="button"
              role="switch"
              aria-checked={form.enabled}
              aria-label="SFV-Integration aktivieren"
              onClick={() => handleChange("enabled", !form.enabled)}
              disabled={saving}
              className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sce-primary)] disabled:opacity-50 disabled:pointer-events-none"
              style={{
                backgroundColor: form.enabled ? "var(--sce-primary)" : "var(--border-strong)",
              }}
              data-testid="toggle-enabled"
            >
              <span
                className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200"
                style={{ transform: form.enabled ? "translateX(20px)" : "translateX(0)" }}
              />
            </button>
            <span className="ml-3 text-sm text-[var(--text-2)]">
              {form.enabled ? "Aktiviert" : "Deaktiviert"}
            </span>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end border-t border-[var(--border)] pt-4">
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              disabled={saving}
              data-testid="btn-save"
            >
              {saving ? "Speichern…" : "Konfiguration speichern"}
            </Button>
          </div>
        </form>
      </SectionCard>

      {/* ── Connection status ──────────────────────────────────────────────── */}
      <SectionCard title="Verbindungsstatus">
        <div className="flex items-center gap-3" data-testid="connection-status">
          {isConfigured ? (
            <StatusIndicator variant="success" label="Konfiguriert" data-testid="status-configured" />
          ) : config !== null && !config.enabled ? (
            <StatusIndicator variant="warning" label="Deaktiviert" data-testid="status-disabled" />
          ) : (
            <StatusIndicator variant="neutral" label="Nicht konfiguriert" data-testid="status-not-configured" />
          )}
        </div>
        {config && (
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between border-b border-[var(--border)] pb-2">
              <dt className="text-[var(--text-2)]">Club ID</dt>
              <dd className="font-semibold">{config.clubId}</dd>
            </div>
            <div className="flex justify-between border-b border-[var(--border)] pb-2">
              <dt className="text-[var(--text-2)]">Standard-Saison</dt>
              <dd className="font-semibold">{config.defaultSeasonId}</dd>
            </div>
            {config.organisationId !== null && (
              <div className="flex justify-between border-b border-[var(--border)] pb-2">
                <dt className="text-[var(--text-2)]">Organisation ID</dt>
                <dd className="font-semibold">{config.organisationId}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-[var(--text-2)]">Zuletzt aktualisiert</dt>
              <dd className="font-mono text-xs text-[var(--muted)]">
                {new Date(config.updatedAt).toLocaleString("de-CH")}
              </dd>
            </div>
          </dl>
        )}
      </SectionCard>

      {/* ── Teams synchronisieren ─────────────────────────────────────────── */}
      <SectionCard
        title="Teams synchronisieren"
        description="SFV-Teams für die konfigurierte Saison importieren und aktualisieren. Club-ID und Saison werden aus der gespeicherten Konfiguration gelesen."
      >
        <div className="space-y-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handleTeamSync}
            loading={teamSync.status === "loading"}
            disabled={teamSync.status === "loading" || !isConfigured}
            data-testid="btn-team-sync"
          >
            {teamSync.status === "loading"
              ? "Synchronisierung läuft…"
              : "Teams synchronisieren"}
          </Button>

          {!isConfigured && teamSync.status === "idle" && (
            <p className="text-xs text-[var(--muted)]">
              Konfigurieren und aktivieren Sie die Integration, um die Teams zu synchronisieren.
            </p>
          )}

          {teamSync.status === "loading" && (
            <p className="text-sm text-[var(--text-2)]" data-testid="team-sync-loading">
              Teams werden synchronisiert — dies kann einige Sekunden dauern…
            </p>
          )}

          {teamSync.status === "error" && (
            <div
              className="rounded-lg border border-[var(--sce-danger-border)] bg-[var(--sce-danger-light)] px-4 py-3"
              data-testid="team-sync-error"
            >
              <p className="text-sm font-medium text-[var(--sce-danger)]">
                {teamSync.message}
              </p>
            </div>
          )}

          {teamSync.status === "success" && (
            <TeamSyncResult data={teamSync.data} />
          )}
        </div>
      </SectionCard>

      {/* ── Diagnostics ───────────────────────────────────────────────────── */}
      <SectionCard
        title="Diagnose"
        description="Vollständige SFV-Pipeline prüfen. Club-ID wird aus der gespeicherten Konfiguration gelesen."
      >
        <div className="space-y-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handleRunDiagnostics}
            loading={diagnostics.status === "loading"}
            disabled={diagnostics.status === "loading" || !isConfigured}
            data-testid="btn-run-diagnostics"
          >
            {diagnostics.status === "loading" ? "Diagnose läuft…" : "Diagnose ausführen"}
          </Button>

          {!isConfigured && diagnostics.status === "idle" && (
            <p className="text-xs text-[var(--muted)]">
              Konfigurieren und aktivieren Sie die Integration, um die Diagnose zu starten.
            </p>
          )}

          {diagnostics.status === "loading" && (
            <p className="text-sm text-[var(--text-2)]" data-testid="diagnostics-loading">
              Diagnose wird ausgeführt — dies kann einige Sekunden dauern…
            </p>
          )}

          {diagnostics.status === "error" && (
            <div
              className="rounded-lg border border-[var(--sce-danger-border)] bg-[var(--sce-danger-light)] px-4 py-3"
              data-testid="diagnostics-error"
            >
              <p className="text-sm font-medium text-[var(--sce-danger)]">{diagnostics.message}</p>
            </div>
          )}

          {diagnostics.status === "success" && (
            <DiagnosticsResult data={diagnostics.data} />
          )}
        </div>
      </SectionCard>
    </div>
  );
}
