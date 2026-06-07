"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type WebsiteSettingsFormProps = {
  defaultValues: {
    approvedDataOnly: boolean;
  };
};

export default function WebsiteSettingsForm({ defaultValues }: WebsiteSettingsFormProps) {
  const router = useRouter();
  const [approvedDataOnly, setApprovedDataOnly] = useState(defaultValues.approvedDataOnly);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);
    setSaving(true);

    try {
      const res = await fetch("/api/website-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvedDataOnly }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data?.error ?? "Fehler beim Speichern.");
        return;
      }
      setSaveSuccess(true);
      router.refresh();
    } catch {
      setSaveError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            Redaktioneller Workflow
          </p>
        </div>
        <div className="sce-detail-section-body space-y-4">
          <div className="flex items-start gap-4">
            <button
              id="approvedDataOnly"
              type="button"
              role="switch"
              aria-checked={approvedDataOnly}
              onClick={() => {
                setApprovedDataOnly((v) => !v);
                setSaveSuccess(false);
              }}
              className={[
                "relative mt-0.5 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2",
                approvedDataOnly ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]",
              ].join(" ")}
            >
              <span
                aria-hidden="true"
                className={[
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                  approvedDataOnly ? "translate-x-5" : "translate-x-0",
                ].join(" ")}
              />
            </button>
            <div>
              <label
                htmlFor="approvedDataOnly"
                className="cursor-pointer text-sm font-medium text-[var(--text-1)]"
              >
                Vier-Augen-Prinzip aktivieren
              </label>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Wenn aktiviert, müssen News und später Seiten/Inhalte zur Prüfung eingereicht
                werden, bevor sie veröffentlicht werden.
              </p>
            </div>
          </div>
        </div>
      </div>

      {saveError ? (
        <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {saveError}
        </div>
      ) : null}
      {saveSuccess ? (
        <div className="rounded-[var(--radius-xl)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          Einstellungen gespeichert.
        </div>
      ) : null}

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="fca-button-primary">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? "Speichern…" : "Einstellungen speichern"}
        </button>
      </div>
    </form>
  );
}
