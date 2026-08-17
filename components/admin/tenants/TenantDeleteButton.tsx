"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

type TenantImpact = {
  persons: number;
  teams: number;
  teamSeasons: number;
  orgUnits: number;
  users: number;
  registrations: number;
  events: number;
  trainingSeries: number;
  trainingSessions: number;
  newsArticles: number;
  mediaAssets: number;
  workspaceDocuments: number;
  infoboards: number;
  facilities: number;
  facilityResources: number;
  auditLogs: number;
};

type Props = {
  tenantSlug: string;
  tenantName: string;
};

/**
 * TenantDeleteButton — permanent-delete action for an entire Tenant.
 *
 * ADMIN-DELETE-TENANT-01: SCE Super Admin only (TENANTS_DELETE permission).
 * Two-step preview/confirm flow.
 *
 * This is the highest-impact delete operation in the platform.
 * Global Users are explicitly preserved.
 */
export default function TenantDeleteButton({ tenantSlug, tenantName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impact, setImpact] = useState<TenantImpact | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const confirmRequired = tenantSlug;
  const confirmReady = confirmText === confirmRequired;

  async function openConfirmation() {
    setOpen(true);
    setError(null);
    setImpact(null);
    setConfirmText("");
    setLoadingImpact(true);

    try {
      const response = await fetch(`/api/tenants/${encodeURIComponent(tenantSlug)}/permanent`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Vorschau nicht verfügbar.");
      setImpact(data?.impact ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setLoadingImpact(false);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmReady) return;
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/tenants/${encodeURIComponent(tenantSlug)}/permanent?confirm=true`,
        { method: "DELETE" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error ?? "Tenant konnte nicht gelöscht werden.");
        return;
      }
      setOpen(false);
      router.push("/dashboard/admin/tenants");
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setDeleting(false);
    }
  }

  const impactRows = impact
    ? [
        { label: "Personen", value: impact.persons },
        { label: "Teams", value: impact.teams },
        { label: "TeamSeasons", value: impact.teamSeasons },
        { label: "Organisationseinheiten", value: impact.orgUnits },
        { label: "Club-Mitgliedschaften", value: impact.users },
        { label: "Anmeldungen", value: impact.registrations },
        { label: "Veranstaltungen / Spiele", value: impact.events },
        { label: "Trainingsserien", value: impact.trainingSeries },
        { label: "Trainingssessions", value: impact.trainingSessions },
        { label: "Newsartikel", value: impact.newsArticles },
        { label: "Medien-Assets", value: impact.mediaAssets },
        { label: "Workspace-Dokumente", value: impact.workspaceDocuments },
        { label: "Infoboards", value: impact.infoboards },
        { label: "Anlagen", value: impact.facilities },
        { label: "Ressourcen", value: impact.facilityResources },
      ].filter((r) => r.value > 0)
    : [];

  return (
    <>
      <button
        type="button"
        onClick={openConfirmation}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-transparent px-3.5 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Tenant endgültig löschen
      </button>

      <Dialog
        open={open}
        onClose={() => !deleting && setOpen(false)}
        title="Tenant endgültig löschen"
        description={`„${tenantName}" (${tenantSlug}) dauerhaft und unwiderruflich aus dem System entfernen.`}
        footer={
          <div className="flex flex-col gap-2">
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={deleting || loadingImpact}
              >
                Abbrechen
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmDelete}
                loading={deleting}
                disabled={loadingImpact || !!error || !confirmReady}
              >
                Tenant endgültig löschen
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-sm text-[var(--text-2)]">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div className="text-red-800">
                <p className="font-semibold">Hochrisiko-Operation — nur für SCE Super Admin.</p>
                <p className="mt-0.5 text-xs">Alle Tenant-Daten werden dauerhaft gelöscht. Globale Benutzerkonten bleiben erhalten.</p>
              </div>
            </div>
          </div>

          {loadingImpact ? (
            <p className="text-[var(--muted)]">Auswirkungen werden geprüft…</p>
          ) : impact ? (
            <>
              {impactRows.length > 0 ? (
                <div>
                  <p className="mb-2 font-medium text-[var(--foreground)]">Wird gelöscht:</p>
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-[var(--border)]">
                        {impactRows.map((row) => (
                          <tr key={row.label}>
                            <td className="px-3 py-1.5 text-[var(--text-2)]">{row.label}</td>
                            <td className="px-3 py-1.5 text-right font-medium tabular-nums">{row.value.toLocaleString("de-CH")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              <div>
                <p className="mb-2 font-medium text-[var(--foreground)]">Bleibt erhalten:</p>
                <ul className="ml-4 list-disc space-y-1 text-xs">
                  <li>Globale Benutzerkonten — Logins und Authentifizierungsdaten unverändert</li>
                  <li>Mitgliedschaften in anderen Tenants nicht betroffen</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="font-medium text-[var(--foreground)]">
                  Zur Bestätigung den Tenant-Schlüssel eingeben:{" "}
                  <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-red-700">{tenantSlug}</code>
                </p>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={tenantSlug}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-mono outline-none focus:border-red-400 focus:ring-1 focus:ring-red-300"
                  autoComplete="off"
                />
              </div>
            </>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
