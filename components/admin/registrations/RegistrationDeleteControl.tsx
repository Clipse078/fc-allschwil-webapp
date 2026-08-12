"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

type Impact = {
  key: string;
  label: string;
  count: number;
};

type Props = {
  tenantSlug: string;
  registrationId: string;
  /** Display label shown in the confirmation dialog (first + last name). */
  registrationLabel: string;
  /**
   * ADMIN-DELETE-03B: effective PERMISSIONS.REGISTRATIONS_DELETE authority,
   * resolved by the caller. Deliberately independent of registrations.edit —
   * archive/status mutations remain governed by their existing permission and
   * are unaffected by this control.
   */
  canDelete: boolean;
  /**
   * Optional callback invoked after successful permanent deletion instead of
   * navigating away. Used by the Cockpit drawer context to close the drawer
   * and remove the item from the list without a full page navigation.
   * When absent the component navigates to the cockpit registrations list.
   */
  onDeleted?: () => void;
  /**
   * When true, suppresses the outer sce-detail-section container and renders
   * only the button. Used by contexts that provide their own visual framing
   * (e.g. the Cockpit drawer's danger zone).
   */
  compact?: boolean;
};

/**
 * RegistrationDeleteControl — permanent-delete action for a Registration.
 *
 * ADMIN-DELETE-03B: dependencies (Person creation links) are shown as IMPACT
 * — a warning — and never block deletion for a registrations.delete holder.
 * Flow: clicking "Löschen" opens the confirmation dialog and fetches the
 * current impact; clicking "Endgültig löschen" permanently removes the
 * registration (see
 * app/api/tenants/[tenantSlug]/registrations/[registrationId]/permanent/route.ts).
 *
 * Archive/status changes continue to work exactly as before via the existing
 * PATCH endpoint — a completely separate, reversible action.
 */
export default function RegistrationDeleteControl({
  tenantSlug,
  registrationId,
  registrationLabel,
  canDelete,
  onDeleted,
  compact = false,
}: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impact, setImpact] = useState<Impact[] | null>(null);

  if (!canDelete) {
    return null;
  }

  async function openConfirmation() {
    setConfirming(true);
    setError(null);
    setImpact(null);
    setLoadingImpact(true);

    try {
      const response = await fetch(
        `/api/tenants/${encodeURIComponent(tenantSlug)}/registrations/${encodeURIComponent(registrationId)}/permanent`,
        { method: "DELETE" },
      );
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Löschen nicht möglich.");
      }

      setImpact(Array.isArray(data?.impact) ? data.impact : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setLoadingImpact(false);
    }
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/tenants/${encodeURIComponent(tenantSlug)}/registrations/${encodeURIComponent(registrationId)}/permanent?confirm=true`,
        { method: "DELETE" },
      );
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Löschen fehlgeschlagen.");
      }

      setConfirming(false);
      if (onDeleted) {
        onDeleted();
        router.refresh();
      } else {
        router.push(`/tenant/${tenantSlug}/cockpit/registrations`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setDeleting(false);
    }
  }

  function closeDialog() {
    setConfirming(false);
    setImpact(null);
    setError(null);
  }

  return (
    <>
      {compact ? (
        <Button
          variant="danger"
          size="sm"
          iconLeft={<Trash2 className="h-3.5 w-3.5" />}
          onClick={openConfirmation}
        >
          Endgültig löschen
        </Button>
      ) : (
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Endgültig löschen
            </p>
          </div>
          <div className="sce-detail-section-body flex flex-col gap-3">
            <p className="text-xs text-[var(--text-2)]">
              Entfernt die Anmeldung unwiderruflich aus der Datenbank.
              Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <Button
              variant="danger"
              size="sm"
              iconLeft={<Trash2 className="h-3.5 w-3.5" />}
              onClick={openConfirmation}
            >
              Löschen
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={confirming}
        onClose={closeDialog}
        title={`„${registrationLabel}" endgültig löschen?`}
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        footer={
          <>
            <Button variant="secondary" onClick={closeDialog}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              disabled={loadingImpact}
              onClick={handleConfirmDelete}
            >
              Endgültig löschen
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {error && (
            <p className="text-sm font-medium text-[var(--sce-danger)]">{error}</p>
          )}

          {loadingImpact ? (
            <p className="text-sm text-[var(--text-2)]">Auswirkungen werden geprüft…</p>
          ) : impact && impact.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2 rounded-lg border border-[var(--sce-warning-border)] bg-[var(--sce-warning-light)] p-3 text-[var(--sce-warning)]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p className="text-sm">
                  Folgende verknüpfte Daten werden ebenfalls unwiderruflich entfernt:
                </p>
              </div>
              <ul className="list-inside list-disc space-y-1 text-sm text-[var(--text-2)]">
                {impact.map((item) => (
                  <li key={item.key}>
                    {item.label}: {item.count}
                  </li>
                ))}
              </ul>
            </div>
          ) : impact ? (
            <p className="text-sm text-[var(--text-2)]">
              Keine weiteren verknüpften Daten vorhanden.
            </p>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
