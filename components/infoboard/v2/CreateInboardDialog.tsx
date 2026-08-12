"use client";

/**
 * components/infoboard/v2/CreateInboardDialog.tsx
 *
 * Modal dialog for creating a new Infoboard.
 * Accepts name + template, generates kiosk URL preview.
 */

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Monitor } from "lucide-react";
import { generateInfoboardSlug } from "@/lib/infoboard/slug";
import { infoboardKioskUrl, TEMPLATE_LABELS } from "@/lib/infoboard/types";

const TEMPLATES = [
  { value: "TAGESUEBERSICHT", label: "Tagesübersicht" },
  { value: "ANLAGENUEBERSICHT", label: "Anlagenübersicht" },
];

type CreateInboardDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function CreateInboardDialog({ open, onClose }: CreateInboardDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [templateType, setTemplateType] = useState("TAGESUEBERSICHT");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const slug = name.trim() ? generateInfoboardSlug(name.trim()) : "";
  const kioskUrl = slug ? infoboardKioskUrl(slug) : "";

  useEffect(() => {
    if (open) {
      setName("");
      setTemplateType("TAGESUEBERSICHT");
      setError(null);
      setSubmitting(false);
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name ist erforderlich.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/infoboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, templateType }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Fehler beim Erstellen des Infoboards.");
        return;
      }

      const { board } = await res.json();
      onClose();
      router.push(`/dashboard/infoboard/${board.id}`);
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <Monitor className="h-4 w-4 text-[var(--muted)]" />
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              Infoboard erstellen
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[var(--muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label
              htmlFor="create-inboard-name"
              className="block text-[0.78rem] font-medium text-[var(--foreground)] mb-1.5"
            >
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="create-inboard-name"
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Clubhaus Eingang"
              maxLength={120}
              className="w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sce-primary)] focus:ring-offset-1"
              required
            />
          </div>

          {/* Template */}
          <div>
            <label
              htmlFor="create-inboard-template"
              className="block text-[0.78rem] font-medium text-[var(--foreground)] mb-1.5"
            >
              Vorlage
            </label>
            <select
              id="create-inboard-template"
              value={templateType}
              onChange={(e) => setTemplateType(e.target.value)}
              className="w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--sce-primary)] focus:ring-offset-1"
            >
              {TEMPLATES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Kiosk URL preview */}
          {kioskUrl && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-3)] px-3.5 py-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)] mb-1">
                Kiosk-URL
              </p>
              <code className="text-[0.78rem] font-mono text-[var(--foreground)]">
                {kioskUrl}
              </code>
              <p className="mt-1.5 text-[0.68rem] text-[var(--muted)]">
                Diese URL ist stabil und ändert sich nicht beim Umbenennen.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-[0.78rem] text-red-600">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="fca-button-secondary text-[0.82rem] px-4 py-2"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="fca-button-primary text-[0.82rem] px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Erstelle…" : "Erstellen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
