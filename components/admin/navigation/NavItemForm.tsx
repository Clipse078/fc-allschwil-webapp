"use client";

import { useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import type { NavItemType } from "@/lib/navigation/admin-queries";

type PageOption = { id: string; slug: string; title: string };

type NavItemFormProps = {
  navKey: "main" | "footer";
  pages: PageOption[];
  onSaved: () => void;
  onCancel: () => void;
  /** Populated when editing an existing item */
  initial?: {
    id: string;
    label: string;
    itemType: NavItemType;
    url: string | null;
    pageId: string | null;
    isVisible: boolean;
    opensInNewTab: boolean;
  };
};

const ITEM_TYPE_LABELS: Record<NavItemType, string> = {
  PAGE: "Website-Seite",
  CUSTOM_URL: "Interne URL",
  EXTERNAL_URL: "Externe URL",
};

export default function NavItemForm({
  navKey,
  pages,
  onSaved,
  onCancel,
  initial,
}: NavItemFormProps) {
  const isEdit = Boolean(initial);

  const [label, setLabel] = useState(initial?.label ?? "");
  const [itemType, setItemType] = useState<NavItemType>(initial?.itemType ?? "CUSTOM_URL");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [pageId, setPageId] = useState(initial?.pageId ?? "");
  const [isVisible, setIsVisible] = useState(initial?.isVisible ?? true);
  const [opensInNewTab, setOpensInNewTab] = useState(initial?.opensInNewTab ?? false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labelClass =
    "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) { setError("Label ist erforderlich."); return; }
    if (itemType === "PAGE" && !pageId) { setError("Bitte eine Seite auswählen."); return; }
    if (itemType !== "PAGE" && !url.trim()) { setError("URL ist erforderlich."); return; }

    setSaving(true);
    setError(null);

    const payload = {
      label: label.trim(),
      itemType,
      url: itemType !== "PAGE" ? url.trim() : null,
      pageId: itemType === "PAGE" ? pageId : null,
      isVisible,
      opensInNewTab,
    };

    try {
      const apiUrl = isEdit
        ? `/api/website-navigation/${navKey}/items/${initial!.id}`
        : `/api/website-navigation/${navKey}/items`;
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(apiUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error ?? "Fehler beim Speichern."); return; }
      onSaved();
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-2)] p-4 space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Label */}
        <div>
          <label className={labelClass}>Label *</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="z. B. Über uns"
            className="fca-input"
            required
          />
        </div>

        {/* Item type */}
        <div>
          <label className={labelClass}>Typ</label>
          <select
            value={itemType}
            onChange={(e) => {
              setItemType(e.target.value as NavItemType);
              setUrl("");
              setPageId("");
            }}
            className="fca-input"
          >
            {(Object.keys(ITEM_TYPE_LABELS) as NavItemType[]).map((t) => (
              <option key={t} value={t}>
                {ITEM_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        {/* URL or page picker */}
        {itemType === "PAGE" ? (
          <div className="sm:col-span-2">
            <label className={labelClass}>Seite *</label>
            <select
              value={pageId}
              onChange={(e) => setPageId(e.target.value)}
              className="fca-input"
            >
              <option value="">— Seite auswählen —</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.slug})
                </option>
              ))}
            </select>
            {pages.length === 0 && (
              <p className="mt-1 text-[10px] text-amber-600">
                Keine veröffentlichten Seiten vorhanden. Veröffentliche zuerst eine Seite.
              </p>
            )}
          </div>
        ) : (
          <div className="sm:col-span-2">
            <label className={labelClass}>
              {itemType === "EXTERNAL_URL" ? "Externe URL *" : "Interner Pfad *"}
            </label>
            <input
              type={itemType === "EXTERNAL_URL" ? "url" : "text"}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={
                itemType === "EXTERNAL_URL"
                  ? "https://example.com"
                  : "/teams"
              }
              className="fca-input"
              required
            />
            {itemType === "CUSTOM_URL" && (
              <p className="mt-1 text-[10px] text-[var(--muted)]">
                Relativer Pfad ab Root, z. B. <code className="bg-[var(--surface)] px-1 rounded">/teams</code>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Options row */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isVisible}
            onChange={(e) => setIsVisible(e.target.checked)}
            className="rounded"
          />
          <span className="text-xs text-[var(--foreground)]">Sichtbar</span>
        </label>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={opensInNewTab}
            onChange={(e) => setOpensInNewTab(e.target.checked)}
            className="rounded"
          />
          <span className="text-xs text-[var(--foreground)]">In neuem Tab öffnen</span>
        </label>
      </div>

      {error && (
        <p className="text-xs text-rose-600">{error}</p>
      )}

      <div className="flex items-center gap-2">
        <button type="submit" disabled={saving} className="fca-button-primary">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? "Speichern…" : isEdit ? "Speichern" : "Hinzufügen"}
        </button>
        <button type="button" onClick={onCancel} className="fca-button-secondary">
          <X className="h-3.5 w-3.5" />
          Abbrechen
        </button>
      </div>
    </form>
  );
}
