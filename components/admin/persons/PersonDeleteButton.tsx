"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2, User } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import type { ReactNode } from "react";

type PersonDeletionImpact = {
  squadMemberships: number;
  trainerMemberships: number;
  personAssignments: number;
  orgUnitMemberships: number;
  linkedRegistrations: number;
  linkedUserId: string | null;
  linkedUserEmail: string | null;
};

type PersonDeleteButtonProps = {
  personId: string;
  personName: string;
  /** Called after successful deletion. If omitted, navigates to /dashboard/persons. */
  onSuccess?: () => void;
  /**
   * When true the confirmation dialog opens (and the impact preview fetch fires)
   * immediately on mount. Use together with `key` to create a fresh instance per
   * person. Intended for list-row usage where the trigger lives outside this
   * component (e.g. a DropdownMenu).
   */
  autoOpen?: boolean;
  /**
   * Called when the dialog is dismissed without confirming (cancel button, X,
   * Escape, backdrop click). Not called on successful deletion.
   */
  onCancel?: () => void;
  /**
   * Custom trigger renderer. When provided, replaces the default red-bordered button.
   * Call the supplied `onClick` to open the confirmation dialog.
   */
  renderTrigger?: (props: { onClick: () => void }) => ReactNode;
};

/**
 * PersonDeleteButton — permanent-delete action for a Person (ADMIN-DELETE-PERSONS-01).
 *
 * Flow: clicking "Löschen" opens the confirmation dialog and fetches the
 * current impact from DELETE /api/people/[id]/permanent (preview mode).
 * Clicking "Endgültig löschen" sends DELETE ?confirm=true to permanently
 * remove the Person. Global User account is explicitly shown as preserved.
 */
export default function PersonDeleteButton({ personId, personName, onSuccess, onCancel, autoOpen, renderTrigger }: PersonDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impact, setImpact] = useState<PersonDeletionImpact | null>(null);

  // Stable ref so the effect below doesn't need openConfirmation in its deps.
  const openConfirmationRef = useRef<() => void>(null!);

  async function openConfirmation() {
    setOpen(true);
    setError(null);
    setImpact(null);
    setLoadingImpact(true);

    try {
      const response = await fetch(`/api/people/${encodeURIComponent(personId)}/permanent`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Vorschau nicht verfügbar.");
      }

      setImpact(data?.impact ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setLoadingImpact(false);
    }
  }

  // Keep the ref in sync so the mount effect always calls the latest version.
  openConfirmationRef.current = openConfirmation;

  // When the component is mounted with autoOpen=true (list-row usage) trigger
  // the preview immediately. Using a ref avoids adding openConfirmation to deps.
  useEffect(() => {
    if (autoOpen) openConfirmationRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConfirmDelete() {
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/people/${encodeURIComponent(personId)}/permanent?confirm=true`,
        { method: "DELETE" },
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data?.error ?? "Person konnte nicht gelöscht werden.");
        return;
      }

      setOpen(false);
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/dashboard/persons");
        router.refresh();
      }
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setDeleting(false);
    }
  }

  const totalMemberships =
    (impact?.squadMemberships ?? 0) + (impact?.trainerMemberships ?? 0);

  return (
    <>
      {renderTrigger ? (
        renderTrigger({ onClick: openConfirmation })
      ) : (
        <button
          type="button"
          onClick={openConfirmation}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-transparent px-3.5 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Endgültig löschen
        </button>
      )}

      <Dialog
        open={open}
        onClose={() => {
          if (!deleting) {
            setOpen(false);
            onCancel?.();
          }
        }}
        title="Person endgültig löschen"
        description={`„${personName}" dauerhaft und unwiderruflich aus dem System entfernen.`}
        footer={
          <div className="flex flex-col gap-2">
            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : null}
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setOpen(false);
                  onCancel?.();
                }}
                disabled={deleting || loadingImpact}
              >
                Abbrechen
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmDelete}
                loading={deleting}
                disabled={loadingImpact || !!error}
              >
                Endgültig löschen
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-sm text-[var(--text-2)]">
          {loadingImpact ? (
            <p className="text-[var(--muted)]">Auswirkungen werden geprüft…</p>
          ) : impact ? (
            <>
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <p className="font-medium text-red-800">
                    Diese Aktion ist dauerhaft und kann nicht rückgängig gemacht werden.
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 font-medium text-[var(--foreground)]">Wird gelöscht:</p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>Personendatensatz von &bdquo;{personName}&ldquo;</li>
                  {impact.personAssignments > 0 && (
                    <li>{impact.personAssignments} Organisationszuordnung{impact.personAssignments !== 1 ? "en" : ""}</li>
                  )}
                  {totalMemberships > 0 && (
                    <li>
                      {totalMemberships} Kader-/Trainermitgliedschaft{totalMemberships !== 1 ? "en" : ""} (squad history)
                    </li>
                  )}
                </ul>
              </div>

              {(impact.orgUnitMemberships > 0 || impact.linkedRegistrations > 0 || impact.linkedUserId) ? (
                <div>
                  <p className="mb-2 font-medium text-[var(--foreground)]">Bleibt erhalten:</p>
                  <ul className="ml-4 list-disc space-y-1">
                    {impact.linkedUserId && (
                      <li className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-[var(--muted)]" />
                        Benutzerkonto ({impact.linkedUserEmail}) — Zugang und Authentifizierungsdaten bleiben unverändert
                      </li>
                    )}
                    {impact.orgUnitMemberships > 0 && (
                      <li>
                        {impact.orgUnitMemberships} OE-Mitgliedschaft{impact.orgUnitMemberships !== 1 ? "en" : ""} — Personen-Link wird entfernt, Mitgliedschaft bleibt bestehen
                      </li>
                    )}
                    {impact.linkedRegistrations > 0 && (
                      <li>
                        {impact.linkedRegistrations} verknüpfte Anmeldung{impact.linkedRegistrations !== 1 ? "en" : ""} — Verlinkung wird getrennt
                      </li>
                    )}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
