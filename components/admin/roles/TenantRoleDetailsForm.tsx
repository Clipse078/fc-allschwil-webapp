"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Archive, Check, Loader2, RotateCcw, Save } from "lucide-react";

type Props = {
  roleId: string;
  initialName: string;
  initialDescription: string | null;
  isArchived: boolean;
  isSystem: boolean;
};

/**
 * Name/description/archive-state editor for a tenant custom role.
 * Protected (`isSystem`) roles render every field disabled — the server
 * (`updateTenantRoleDetails`) rejects these writes too, this is purely a UX
 * shortcut to avoid a round trip that would only ever fail.
 */
export default function TenantRoleDetailsForm({
  roleId,
  initialName,
  initialDescription,
  isArchived,
  isSystem,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isDirty = name !== initialName || description !== (initialDescription ?? "");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tenant/roles/${roleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Rolle konnte nicht gespeichert werden.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchiveToggle() {
    if (!isArchived && !confirmArchive) {
      setConfirmArchive(true);
      return;
    }
    setArchiving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenant/roles/${roleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: !isArchived }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Aktion fehlgeschlagen.");
        return;
      }
      setConfirmArchive(false);
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setArchiving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {isSystem && (
        <div className="flex items-start gap-3 rounded-[var(--radius-xl)] border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-[12px] text-amber-800">
            Diese Rolle ist systemgeschützt. Name, Beschreibung und Aktiv-Status können nicht
            geändert werden.
          </p>
        </div>
      )}

      <div>
        <label htmlFor="tenant-role-name" className="sce-data-label">
          Rollenname
        </label>
        <input
          id="tenant-role-name"
          type="text"
          value={name}
          disabled={isSystem}
          onChange={(e) => setName(e.target.value)}
          className="fca-input mt-1 w-full"
          maxLength={120}
        />
      </div>
      <div>
        <label htmlFor="tenant-role-description" className="sce-data-label">
          Beschreibung
        </label>
        <textarea
          id="tenant-role-description"
          value={description}
          disabled={isSystem}
          onChange={(e) => setDescription(e.target.value)}
          className="fca-input mt-1 w-full"
          rows={2}
        />
      </div>

      {error && (
        <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-medium text-rose-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="submit"
          disabled={isSystem || !isDirty || submitting}
          className="fca-button-primary disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved && !isDirty ? (
            <Check className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {submitting ? "Speichern…" : "Speichern"}
        </button>

        {!isSystem && (
          <div className="flex items-center gap-2">
            {confirmArchive && !isArchived && (
              <span className="text-[0.75rem] font-medium text-rose-700">Wirklich archivieren?</span>
            )}
            <button
              type="button"
              onClick={handleArchiveToggle}
              disabled={archiving}
              className="fca-button-secondary flex items-center gap-2 disabled:opacity-50"
            >
              {archiving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isArchived ? (
                <RotateCcw className="h-4 w-4" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
              {isArchived ? "Reaktivieren" : confirmArchive ? "Ja, archivieren" : "Archivieren"}
            </button>
            {confirmArchive && !isArchived && (
              <button
                type="button"
                onClick={() => setConfirmArchive(false)}
                className="text-[0.75rem] font-medium text-[var(--text-2)] hover:text-[var(--foreground)]"
              >
                Abbrechen
              </button>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
