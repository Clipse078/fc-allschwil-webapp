"use client";

/**
 * HomepageBlockForm — inline block configuration editor.
 *
 * Renders different fields based on block type.
 * Reuses NewsHeroMediaPicker pattern for image selection.
 */

import { useState } from "react";
import { Loader2, Save, Send, CheckCircle, XCircle, Eye, EyeOff, Archive } from "lucide-react";
import NewsHeroMediaPicker from "@/components/admin/news/NewsHeroMediaPicker";
import MediaLibraryGrid from "@/components/admin/media/MediaLibraryGrid";
import MediaUploadButton from "@/components/admin/media/MediaUploadButton";
import type {
  HomepageBlockAdminItem,
  WebsiteBlockType,
  HeroBlockConfig,
  RichTextBlockConfig,
  NewsBlockConfig,
  UpcomingMatchesBlockConfig,
  SponsorsBlockConfig,
  CtaBlockConfig,
  GalleryBlockConfig,
  SponsorEntry,
  GalleryMediaItem,
  AnyBlockConfig,
} from "@/lib/homepage/types";
import type { MediaAssetListItem } from "@/lib/media/types";

const labelClass =
  "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5";

type MediaValue = { id: string; url: string; altText: string | null; filename: string } | null;

type Props = {
  block: HomepageBlockAdminItem;
  requiresReview: boolean;
  onSaved: (updated: HomepageBlockAdminItem) => void;
  onCancel: () => void;
};

export default function HomepageBlockForm({ block, requiresReview, onSaved, onCancel }: Props) {
  const [title, setTitle] = useState(block.title);
  const [config, setConfig] = useState<AnyBlockConfig>(block.config);
  const [reviewNotes, setReviewNotes] = useState(block.reviewNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = block.status;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/homepage-blocks/${block.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, config, reviewNotes: reviewNotes || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error ?? "Speicherfehler"); return; }
      onSaved(data.block);
    } finally {
      setSaving(false);
    }
  }

  async function doAction(action: string, extraBody?: Record<string, unknown>) {
    setActionPending(action);
    setError(null);
    try {
      const qs = action !== "publish" ? `?action=${action}` : "";
      const res = await fetch(`/api/homepage-blocks/${block.id}/publish${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(extraBody ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error ?? "Fehler"); return; }
      if (data.block) onSaved(data.block);
      else onSaved({ ...block, status: "ARCHIVED" });
    } finally {
      setActionPending(null);
    }
  }

  const isPending = saving || actionPending !== null;

  return (
    <div className="space-y-5 border-t border-[var(--border)] bg-[var(--surface-2)] p-4">
      {error && (
        <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Internal title */}
      <div>
        <label className={labelClass}>Interner Titel</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="fca-input"
          placeholder="Block-Bezeichnung (intern)"
        />
      </div>

      {/* Type-specific fields */}
      <BlockTypeFields type={block.type} config={config} onChange={setConfig} />

      {/* Review notes */}
      {(status === "DRAFT" || status === "IN_REVIEW") && (
        <div>
          <label className={labelClass}>Review-Notizen</label>
          <textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            rows={2}
            className="fca-input resize-none"
            placeholder="Feedback für Reviewer / Editor"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="fca-button-primary flex items-center gap-1.5"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Speichern
        </button>

        {/* Review workflow (approvedDataOnly) */}
        {requiresReview && status === "DRAFT" && (
          <button
            type="button"
            onClick={() => doAction("submit")}
            disabled={isPending}
            className="fca-button-secondary flex items-center gap-1.5 text-blue-700"
          >
            <Send className="h-3.5 w-3.5" />
            Zur Prüfung einreichen
          </button>
        )}

        {requiresReview && status === "IN_REVIEW" && (
          <>
            <button
              type="button"
              onClick={() => doAction("approve")}
              disabled={isPending}
              className="fca-button-secondary flex items-center gap-1.5 text-emerald-700"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Genehmigen &amp; Veröffentlichen
            </button>
            <button
              type="button"
              onClick={() => doAction("reject", { notes: reviewNotes || null })}
              disabled={isPending}
              className="fca-button-secondary flex items-center gap-1.5 text-rose-700"
            >
              <XCircle className="h-3.5 w-3.5" />
              Ablehnen
            </button>
          </>
        )}

        {/* Direct publish (no review required) */}
        {!requiresReview && status !== "IN_REVIEW" && (
          <button
            type="button"
            onClick={() => doAction(status === "PUBLISHED" ? "unpublish" : "publish")}
            disabled={isPending}
            className={`fca-button-secondary flex items-center gap-1.5 ${
              status === "PUBLISHED" ? "text-amber-700" : "text-emerald-700"
            }`}
          >
            {status === "PUBLISHED" ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            {status === "PUBLISHED" ? "Depublizieren" : "Veröffentlichen"}
          </button>
        )}

        {/* Archive */}
        {status !== "ARCHIVED" && (
          <button
            type="button"
            onClick={() => {
              if (!window.confirm("Block archivieren?")) return;
              doAction("archive");
            }}
            disabled={isPending}
            className="fca-button-secondary flex items-center gap-1.5 text-[var(--muted)]"
          >
            <Archive className="h-3.5 w-3.5" />
            Archivieren
          </button>
        )}

        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="fca-button-secondary"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}

// ── Per-type field renderers ───────────────────────────────────────────────────

function BlockTypeFields({
  type,
  config,
  onChange,
}: {
  type: WebsiteBlockType;
  config: AnyBlockConfig;
  onChange: (c: AnyBlockConfig) => void;
}) {
  switch (type) {
    case "HERO":
      return <HeroFields config={config as HeroBlockConfig} onChange={onChange} />;
    case "RICH_TEXT":
      return <RichTextFields config={config as RichTextBlockConfig} onChange={onChange} />;
    case "NEWS":
      return <NewsFields config={config as NewsBlockConfig} onChange={onChange} />;
    case "UPCOMING_MATCHES":
      return (
        <UpcomingMatchesFields
          config={config as UpcomingMatchesBlockConfig}
          onChange={onChange}
        />
      );
    case "SPONSORS":
      return <SponsorsFields config={config as SponsorsBlockConfig} onChange={onChange} />;
    case "CTA":
      return <CtaFields config={config as CtaBlockConfig} onChange={onChange} />;
    case "GALLERY":
      return <GalleryFields config={config as GalleryBlockConfig} onChange={onChange} />;
    default:
      return null;
  }
}

// ── HERO ──────────────────────────────────────────────────────────────────────

function HeroFields({
  config,
  onChange,
}: {
  config: HeroBlockConfig;
  onChange: (c: AnyBlockConfig) => void;
}) {
  const media: MediaValue = config.backgroundMediaId
    ? {
        id: config.backgroundMediaId,
        url: config.backgroundMediaUrl ?? "",
        altText: config.backgroundMediaAlt ?? null,
        filename: config.backgroundMediaUrl?.split("/").pop() ?? "",
      }
    : null;

  function handleMedia(asset: MediaValue) {
    onChange({
      ...config,
      backgroundMediaId: asset?.id ?? null,
      backgroundMediaUrl: asset?.url ?? null,
      backgroundMediaAlt: asset?.altText ?? null,
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Headline *</label>
        <input
          type="text"
          value={config.headline ?? ""}
          onChange={(e) => onChange({ ...config, headline: e.target.value })}
          className="fca-input"
          placeholder="Willkommen beim FC Allschwil"
        />
      </div>
      <div>
        <label className={labelClass}>Subheadline</label>
        <input
          type="text"
          value={config.subheadline ?? ""}
          onChange={(e) => onChange({ ...config, subheadline: e.target.value || null })}
          className="fca-input"
          placeholder="Kurzer Beschreibungstext"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>CTA-Bezeichnung</label>
          <input
            type="text"
            value={config.ctaLabel ?? ""}
            onChange={(e) => onChange({ ...config, ctaLabel: e.target.value || null })}
            className="fca-input"
            placeholder="Mehr erfahren"
          />
        </div>
        <div>
          <label className={labelClass}>CTA-URL</label>
          <input
            type="url"
            value={config.ctaUrl ?? ""}
            onChange={(e) => onChange({ ...config, ctaUrl: e.target.value || null })}
            className="fca-input"
            placeholder="https://..."
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Hintergrundbild</label>
        <NewsHeroMediaPicker value={media} onChange={handleMedia} />
      </div>
    </div>
  );
}

// ── RICH TEXT ─────────────────────────────────────────────────────────────────

function RichTextFields({
  config,
  onChange,
}: {
  config: RichTextBlockConfig;
  onChange: (c: AnyBlockConfig) => void;
}) {
  const media: MediaValue = config.imageMediaId
    ? {
        id: config.imageMediaId,
        url: config.imageMediaUrl ?? "",
        altText: config.imageMediaAlt ?? null,
        filename: config.imageMediaUrl?.split("/").pop() ?? "",
      }
    : null;

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Titel</label>
        <input
          type="text"
          value={config.bodyTitle ?? ""}
          onChange={(e) => onChange({ ...config, bodyTitle: e.target.value || null })}
          className="fca-input"
          placeholder="Abschnittstitel"
        />
      </div>
      <div>
        <label className={labelClass}>Text *</label>
        <textarea
          rows={5}
          value={config.text ?? ""}
          onChange={(e) => onChange({ ...config, text: e.target.value })}
          className="fca-input resize-y"
          placeholder="Inhalt des Blocks…"
        />
      </div>
      <div>
        <label className={labelClass}>Bild (optional)</label>
        <NewsHeroMediaPicker value={media} onChange={(a) => onChange({
          ...config,
          imageMediaId: a?.id ?? null,
          imageMediaUrl: a?.url ?? null,
          imageMediaAlt: a?.altText ?? null,
        })} />
      </div>
    </div>
  );
}

// ── NEWS ──────────────────────────────────────────────────────────────────────

function NewsFields({
  config,
  onChange,
}: {
  config: NewsBlockConfig;
  onChange: (c: AnyBlockConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Anzahl Artikel</label>
        <input
          type="number"
          min={1}
          max={20}
          value={config.showCount ?? 3}
          onChange={(e) =>
            onChange({ ...config, showCount: Math.max(1, Math.min(20, Number(e.target.value))) })
          }
          className="fca-input w-24"
        />
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={config.featuredOnly ?? false}
          onChange={(e) => onChange({ ...config, featuredOnly: e.target.checked })}
          className="h-4 w-4 rounded border-[var(--border)]"
        />
        <span>Nur featured Artikel</span>
      </label>
    </div>
  );
}

// ── UPCOMING MATCHES ──────────────────────────────────────────────────────────

function UpcomingMatchesFields({
  config,
  onChange,
}: {
  config: UpcomingMatchesBlockConfig;
  onChange: (c: AnyBlockConfig) => void;
}) {
  return (
    <div>
      <label className={labelClass}>Anzahl Spiele</label>
      <input
        type="number"
        min={1}
        max={20}
        value={config.showCount ?? 5}
        onChange={(e) =>
          onChange({ ...config, showCount: Math.max(1, Math.min(20, Number(e.target.value))) })
        }
        className="fca-input w-24"
      />
      <p className="mt-1.5 text-[11px] text-[var(--muted)]">
        Zeigt die nächsten Heimspiele und Auswärtsspiele.
      </p>
    </div>
  );
}

// ── SPONSORS ──────────────────────────────────────────────────────────────────

function SponsorsFields({
  config,
  onChange,
}: {
  config: SponsorsBlockConfig;
  onChange: (c: AnyBlockConfig) => void;
}) {
  function addSponsor() {
    onChange({ ...config, sponsors: [...(config.sponsors ?? []), { name: "" }] });
  }

  function removeSponsor(idx: number) {
    onChange({ ...config, sponsors: config.sponsors.filter((_, i) => i !== idx) });
  }

  function updateSponsor(idx: number, patch: Partial<SponsorEntry>) {
    onChange({
      ...config,
      sponsors: config.sponsors.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Darstellung</label>
          <select
            value={config.displayStyle ?? "grid"}
            onChange={(e) =>
              onChange({ ...config, displayStyle: e.target.value as "grid" | "list" })
            }
            className="fca-input"
          >
            <option value="grid">Raster</option>
            <option value="list">Liste</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Max. Anzahl</label>
          <input
            type="number"
            min={1}
            max={50}
            value={config.showCount ?? 10}
            onChange={(e) =>
              onChange({ ...config, showCount: Math.max(1, Math.min(50, Number(e.target.value))) })
            }
            className="fca-input"
          />
        </div>
      </div>

      <div>
        <p className={`${labelClass} mb-2`}>Sponsoren-Liste</p>
        <div className="space-y-2">
          {(config.sponsors ?? []).map((s, i) => (
            <div
              key={i}
              className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2"
            >
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  type="text"
                  value={s.name}
                  onChange={(e) => updateSponsor(i, { name: e.target.value })}
                  className="fca-input text-sm"
                  placeholder="Sponsor-Name *"
                />
                <input
                  type="url"
                  value={s.logoUrl ?? ""}
                  onChange={(e) => updateSponsor(i, { logoUrl: e.target.value || null })}
                  className="fca-input text-sm"
                  placeholder="Logo-URL"
                />
                <input
                  type="url"
                  value={s.websiteUrl ?? ""}
                  onChange={(e) => updateSponsor(i, { websiteUrl: e.target.value || null })}
                  className="fca-input text-sm"
                  placeholder="Website-URL"
                />
              </div>
              <button
                type="button"
                onClick={() => removeSponsor(i)}
                className="text-[11px] text-rose-600 hover:underline"
              >
                Entfernen
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addSponsor}
          className="mt-2 fca-button-secondary text-xs"
        >
          + Sponsor hinzufügen
        </button>
      </div>
    </div>
  );
}

// ── CTA ───────────────────────────────────────────────────────────────────────

function CtaFields({
  config,
  onChange,
}: {
  config: CtaBlockConfig;
  onChange: (c: AnyBlockConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Titel *</label>
        <input
          type="text"
          value={config.ctaTitle ?? ""}
          onChange={(e) => onChange({ ...config, ctaTitle: e.target.value })}
          className="fca-input"
          placeholder="Werde Mitglied"
        />
      </div>
      <div>
        <label className={labelClass}>Beschreibung</label>
        <textarea
          rows={3}
          value={config.description ?? ""}
          onChange={(e) => onChange({ ...config, description: e.target.value || null })}
          className="fca-input resize-none"
          placeholder="Kurze Beschreibung…"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Button-Bezeichnung *</label>
          <input
            type="text"
            value={config.buttonLabel ?? ""}
            onChange={(e) => onChange({ ...config, buttonLabel: e.target.value })}
            className="fca-input"
            placeholder="Jetzt anmelden"
          />
        </div>
        <div>
          <label className={labelClass}>Button-URL *</label>
          <input
            type="url"
            value={config.buttonUrl ?? ""}
            onChange={(e) => onChange({ ...config, buttonUrl: e.target.value })}
            className="fca-input"
            placeholder="https://..."
          />
        </div>
      </div>
    </div>
  );
}

// ── GALLERY ───────────────────────────────────────────────────────────────────

function GalleryFields({
  config,
  onChange,
}: {
  config: GalleryBlockConfig;
  onChange: (c: AnyBlockConfig) => void;
}) {
  const [showLibrary, setShowLibrary] = useState(false);

  function handleSelect(asset: MediaAssetListItem) {
    if (config.mediaIds.includes(asset.id)) return; // already added
    const newItem: GalleryMediaItem = {
      id: asset.id,
      url: asset.url,
      altText: asset.altText,
      filename: asset.filename,
    };
    onChange({
      ...config,
      mediaIds: [...config.mediaIds, asset.id],
      mediaItems: [...(config.mediaItems ?? []), newItem],
    });
  }

  function handleUploaded(asset: MediaAssetListItem) {
    handleSelect(asset);
    setShowLibrary(false);
  }

  function removeItem(id: string) {
    onChange({
      ...config,
      mediaIds: config.mediaIds.filter((x) => x !== id),
      mediaItems: (config.mediaItems ?? []).filter((x) => x.id !== id),
    });
  }

  return (
    <div className="space-y-3">
      {/* Selected items */}
      {(config.mediaItems ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(config.mediaItems ?? []).map((item) => (
            <div
              key={item.id}
              className="relative h-20 w-20 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)]"
            >
              <img
                src={item.url}
                alt={item.altText ?? item.filename}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 px-1 py-0.5 text-[10px] text-white hover:bg-black/80"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowLibrary(!showLibrary)}
          className="fca-button-secondary text-xs"
        >
          {showLibrary ? "Bibliothek schliessen" : "Bilder aus Bibliothek wählen"}
        </button>
        <MediaUploadButton
          onUploaded={handleUploaded}
          label="Bild hochladen"
          className="fca-button-secondary text-xs"
        />
      </div>

      {showLibrary && (
        <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-4">
          <MediaLibraryGrid onSelect={handleSelect} selectable />
        </div>
      )}
    </div>
  );
}
