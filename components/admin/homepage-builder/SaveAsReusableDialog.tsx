"use client";

/**
 * SaveAsReusableDialog — "Als wiederverwendbaren Block speichern"
 *
 * Opens when an editor wants to snapshot a configured section into the
 * Reusable Content Library. The snapshot is a local copy: later changes to
 * the saved library item do NOT affect the original section, and vice-versa.
 *
 * Usage:
 *   <SaveAsReusableDialog
 *     open={open}
 *     sectionType="hero"
 *     sectionLabel="Mein Hero"
 *     sectionConfig={{ title: "…" }}
 *     onClose={() => setOpen(false)}
 *     onSaved={() => { ... }}
 *   />
 */

import { useState, useEffect } from "react";
import { X, Bookmark, Check, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import { getTypeLabel } from "@/lib/reusable-components/component-types";

type Props = {
  open: boolean;
  sectionType: string;
  sectionLabel: string;
  sectionConfig: Record<string, unknown>;
  onClose: () => void;
  onSaved?: (componentId: string) => void;
};

export function SaveAsReusableDialog({
  open,
  sectionType,
  sectionLabel,
  sectionConfig,
  onClose,
  onSaved,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const typeLabel = getTypeLabel(sectionType);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setTitle(sectionLabel);
      setDescription("");
      setError(null);
      setSavedId(null);
    }
  }, [open, sectionLabel]);

  async function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Bitte gib einen Namen ein.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/reusable-components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: sectionType,
          title: trimmedTitle,
          description: description.trim() || undefined,
          config: sectionConfig,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? "Speichern fehlgeschlagen.");
      }
      setSavedId(data.component?.id ?? null);
      onSaved?.(data.component?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (saving) return;
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={handleClose}
    >
      <div
        className="flex w-full max-w-md flex-col rounded-t-2xl sm:rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: "var(--tenant-accent)", color: "var(--tenant-primary)" }}
            >
              <Bookmark className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--foreground)]">
                Als wiederverwendbaren Block speichern
              </h2>
              <p className="text-[11px] text-[var(--muted)]">{typeLabel}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {savedId ? (
          /* Success state */
          <div className="px-5 py-6 space-y-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <Check className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Block gespeichert!
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  Wird in der Bibliothek als Entwurf angezeigt.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleClose}
                className="fca-button-secondary flex-1"
              >
                Schliessen
              </button>
              <a
                href={`/dashboard/website/components/${savedId}/edit`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium"
                style={{ background: "var(--tenant-primary)", color: "#fff" }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Bibliothek öffnen
              </a>
            </div>
          </div>
        ) : (
          /* Form state */
          <div className="px-5 py-5 space-y-4">
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Die aktuelle Konfiguration wird als Vorlage in der{" "}
              <strong className="text-[var(--foreground)]">Wiederverwendbaren Inhalte</strong>{" "}
              Bibliothek gespeichert. Als Kopie eingefügte Instanzen sind unabhängig vom Original.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={saving}
                maxLength={200}
                placeholder="z.B. Hero — Saisonauftakt 2025"
                className="fca-input w-full"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                Beschreibung{" "}
                <span className="text-[var(--muted)] font-normal">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={saving}
                maxLength={500}
                rows={2}
                placeholder="Wofür wird dieser Block verwendet?"
                className="fca-textarea resize-none"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving || !title.trim()}
                className="fca-button-primary flex-1"
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
                    Wird gespeichert…
                  </>
                ) : (
                  <>
                    <Bookmark className="h-3.5 w-3.5 shrink-0" />
                    In Bibliothek speichern
                  </>
                )}
              </button>
              <button
                onClick={handleClose}
                disabled={saving}
                className="fca-button-secondary"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
