"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Eye,
  EyeOff,
  Save,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
} from "lucide-react";
import HomepageBlockStatusBadge from "@/components/admin/homepage-blocks/HomepageBlockStatusBadge";
import HeroBlockRenderer from "@/components/admin/homepage-blocks/HeroBlockRenderer";
import HeroStylingPanel, { type HeroStylingValues } from "@/components/admin/homepage-blocks/HeroStylingPanel";
import MediaLibraryGrid from "@/components/admin/media/MediaLibraryGrid";
import MediaUploadButton from "@/components/admin/media/MediaUploadButton";
import type { MediaAssetListItem } from "@/lib/media/types";
import type {
  HomepageBlockAdminItem,
  BlockStatus,
} from "@/lib/homepage-blocks/admin-queries";

type HomepageBlockFormProps = {
  block?: HomepageBlockAdminItem;
  requiresReview?: boolean;
  tenantPrimaryColor?: string;
  tenantSecondaryColor?: string;
};

const labelClass =
  "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5";

function toLocalDatetimeValue(date: Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export default function HomepageBlockForm({
  block,
  requiresReview = false,
  tenantPrimaryColor = "#0b4aa2",
  tenantSecondaryColor = "#c7332c",
}: HomepageBlockFormProps) {
  const router = useRouter();
  const isEdit = Boolean(block);

  const rawData = (block?.data ?? {}) as {
    headline?: string;
    subheadline?: string;
    ctaLabel?: string;
    ctaUrl?: string;
  };

  const [title, setTitle] = useState(block?.title ?? "");
  const [headline, setHeadline] = useState(rawData.headline ?? "");
  const [subheadline, setSubheadline] = useState(rawData.subheadline ?? "");
  const [ctaLabel, setCtaLabel] = useState(rawData.ctaLabel ?? "");
  const [ctaUrl, setCtaUrl] = useState(rawData.ctaUrl ?? "");

  const [heroMedia, setHeroMedia] = useState<{
    id: string;
    url: string;
    altText: string | null;
    filename: string;
  } | null>(block?.heroMedia ?? null);
  const [showLibrary, setShowLibrary] = useState(false);

  const [styling, setStyling] = useState<HeroStylingValues>({
    overlayColor: block?.overlayColor ?? "",
    overlayOpacity: block?.overlayOpacity ?? 40,
    gradientType: block?.gradientType ?? "none",
    gradientFrom: block?.gradientFrom ?? "",
    gradientTo: block?.gradientTo ?? "",
    textColor: block?.textColor ?? "light",
  });

  const [scheduledAtInput, setScheduledAtInput] = useState<string>(
    toLocalDatetimeValue(block?.scheduledAt),
  );
  const [reviewNotes, setReviewNotes] = useState(block?.reviewNotes ?? "");

  const [saving, setSaving] = useState(false);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [status, setStatus] = useState<BlockStatus>(
    (block?.status as BlockStatus) ?? "DRAFT",
  );

  const [showLivePreview, setShowLivePreview] = useState(true);

  function buildPayload() {
    const scheduledAt = scheduledAtInput ? new Date(scheduledAtInput).toISOString() : null;
    return {
      title: title.trim(),
      data: {
        headline: headline.trim(),
        subheadline: subheadline.trim(),
        ctaLabel: ctaLabel.trim(),
        ctaUrl: ctaUrl.trim(),
      },
      heroMediaId: heroMedia?.id ?? null,
      overlayColor: styling.overlayColor || null,
      overlayOpacity: styling.overlayColor ? styling.overlayOpacity : null,
      gradientType: styling.gradientType && styling.gradientType !== "none" ? styling.gradientType : null,
      gradientFrom: styling.gradientFrom || null,
      gradientTo: styling.gradientTo || null,
      textColor: styling.textColor || null,
      scheduledAt,
    };
  }

  const previewBlock: HomepageBlockAdminItem = {
    id: block?.id ?? "__preview__",
    type: "HERO",
    sortOrder: block?.sortOrder ?? 0,
    status,
    title: title || "Vorschau",
    data: {
      headline,
      subheadline,
      ctaLabel,
      ctaUrl,
    },
    heroMediaId: heroMedia?.id ?? null,
    heroMedia: heroMedia ?? null,
    overlayColor: styling.overlayColor || null,
    overlayOpacity: styling.overlayColor ? styling.overlayOpacity : null,
    gradientType: styling.gradientType && styling.gradientType !== "none" ? styling.gradientType : null,
    gradientFrom: styling.gradientFrom || null,
    gradientTo: styling.gradientTo || null,
    textColor: styling.textColor || null,
    publishedAt: block?.publishedAt ?? null,
    scheduledAt: block?.scheduledAt ?? null,
    reviewNotes: block?.reviewNotes ?? null,
    createdAt: block?.createdAt ?? new Date(),
    updatedAt: block?.updatedAt ?? new Date(),
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setSaveError("Titel ist erforderlich."); return; }
    setSaveError(null);
    setSaving(true);
    try {
      const url = isEdit ? `/api/homepage-blocks/${block!.id}` : "/api/homepage-blocks";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveError(data?.error ?? "Fehler beim Speichern."); return; }

      const savedId: string = data.block?.id ?? block?.id;
      setStatus(data.block?.status as BlockStatus ?? status);
      router.push(`/dashboard/website/homepage/${savedId}/edit`);
      router.refresh();
    } catch {
      setSaveError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  async function doAction(action: string, extraBody?: Record<string, unknown>) {
    if (!block) return;
    setActionPending(action);
    setSaveError(null);
    try {
      const suffix = action === "publish" ? "" : `?action=${action}`;
      const res = await fetch(`/api/homepage-blocks/${block.id}/publish${suffix}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(extraBody ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveError(data?.error ?? "Fehler beim Statuswechsel."); return; }
      setStatus(data.block?.status as BlockStatus);
      router.refresh();
    } catch {
      setSaveError("Netzwerkfehler.");
    } finally {
      setActionPending(null);
    }
  }

  const isPending = (a: string) => actionPending === a;

  function handleMediaSelect(asset: MediaAssetListItem) {
    setHeroMedia({ id: asset.id, url: asset.url, altText: asset.altText, filename: asset.filename });
    setShowLibrary(false);
  }

  function handleMediaUploaded(asset: MediaAssetListItem) {
    setHeroMedia({ id: asset.id, url: asset.url, altText: asset.altText, filename: asset.filename });
    setShowLibrary(false);
  }

  return (
    <form onSubmit={handleSave} className="grid gap-8 lg:grid-cols-[1fr_320px]">
      {/* Left — main fields */}
      <div className="space-y-6">
        {/* Internal title */}
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Block-Einstellungen
            </p>
          </div>
          <div className="sce-detail-section-body space-y-4">
            <div>
              <label className={labelClass}>Interner Titel *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z. B. «Haupthero Sommerkampagne»"
                className="fca-input"
                required
              />
              <p className="mt-1 text-[10px] text-[var(--muted)]">
                Wird nur intern angezeigt — nicht auf der Website.
              </p>
            </div>
          </div>
        </div>

        {/* Hero Content */}
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Hero-Inhalt
            </p>
          </div>
          <div className="sce-detail-section-body space-y-4">
            <div>
              <label className={labelClass}>Überschrift</label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Hauptüberschrift des Hero-Blocks"
                className="fca-input text-lg font-semibold"
              />
            </div>
            <div>
              <label className={labelClass}>Unterüberschrift</label>
              <textarea
                value={subheadline}
                onChange={(e) => setSubheadline(e.target.value)}
                placeholder="Optionaler Begleittext unter der Überschrift…"
                rows={3}
                className="fca-input resize-y"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>CTA-Beschriftung</label>
                <input
                  type="text"
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  placeholder="z. B. «Jetzt entdecken»"
                  className="fca-input"
                />
              </div>
              <div>
                <label className={labelClass}>CTA-URL</label>
                <input
                  type="url"
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  placeholder="https://…"
                  className="fca-input"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Hintergrundbild */}
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Hintergrundbild
            </p>
          </div>
          <div className="sce-detail-section-body space-y-3">
            {heroMedia ? (
              <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)]">
                <img
                  src={heroMedia.url}
                  alt={heroMedia.altText ?? heroMedia.filename}
                  className="h-40 w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-3 py-2">
                  <p className="truncate text-[11px] text-white">{heroMedia.filename}</p>
                  <button
                    type="button"
                    onClick={() => setHeroMedia(null)}
                    className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px] text-white transition hover:bg-white/40"
                  >
                    Entfernen
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex h-28 items-center justify-center rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]">
                <p className="text-xs">Kein Hintergrundbild gewählt</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowLibrary(!showLibrary)}
                className="fca-button-secondary text-xs"
              >
                {showLibrary ? "Bibliothek schliessen" : "Aus Bibliothek wählen"}
              </button>
              <MediaUploadButton
                onUploaded={handleMediaUploaded}
                label="Neues Bild hochladen"
                className="fca-button-secondary text-xs"
              />
            </div>
            {showLibrary && (
              <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-4">
                <MediaLibraryGrid onSelect={handleMediaSelect} selectable />
              </div>
            )}
          </div>
        </div>

        {/* Styling */}
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Bild-Styling
            </p>
          </div>
          <div className="sce-detail-section-body">
            <HeroStylingPanel
              values={styling}
              onChange={setStyling}
              tenantPrimaryColor={tenantPrimaryColor}
              tenantSecondaryColor={tenantSecondaryColor}
            />
          </div>
        </div>

        {/* Live Preview */}
        <div className="sce-detail-section">
          <div className="sce-detail-section-header flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Live-Vorschau
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowLivePreview(!showLivePreview)}
                className="fca-button-secondary text-xs"
              >
                {showLivePreview ? "Ausblenden" : "Einblenden"}
              </button>
              {isEdit && (
                <a
                  href="/dashboard/website/homepage/preview"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="fca-button-secondary text-xs inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Vollbild-Vorschau
                </a>
              )}
            </div>
          </div>
          {showLivePreview && (
            <div className="sce-detail-section-body">
              <p className="mb-3 text-[10px] text-[var(--muted)]">
                Echtzeit-Vorschau basierend auf den aktuellen Formulareingaben. Änderungen
                müssen gespeichert werden, damit sie in der öffentlichen Vorschau erscheinen.
              </p>
              <HeroBlockRenderer
                block={previewBlock}
                tenantPrimaryColor={tenantPrimaryColor}
                tenantSecondaryColor={tenantSecondaryColor}
                showStatusBadge
              />
            </div>
          )}
        </div>

        {/* Review notes */}
        {isEdit && (status === "DRAFT" || status === "IN_REVIEW") && (
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Prüfungsnotizen
              </p>
            </div>
            <div className="sce-detail-section-body">
              {block?.reviewNotes && (
                <div className="mb-3 rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide">
                    Feedback vom Prüfer
                  </p>
                  <p className="whitespace-pre-wrap text-xs">{block.reviewNotes}</p>
                </div>
              )}
              {requiresReview && status === "IN_REVIEW" && (
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Feedback / Änderungsanfrage (optional)…"
                  rows={3}
                  className="fca-input resize-none text-xs"
                />
              )}
            </div>
          </div>
        )}

        {/* Errors */}
        {saveError && (
          <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {saveError}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving} className="fca-button-primary">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Speichern…" : isEdit ? "Speichern" : "Entwurf erstellen"}
          </button>

          {isEdit && requiresReview && status === "DRAFT" && (
            <button
              type="button"
              disabled={!!actionPending}
              onClick={() => doAction("submit")}
              className="fca-button-secondary text-blue-700"
            >
              {isPending("submit") ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Zur Prüfung einreichen
            </button>
          )}

          {isEdit && requiresReview && status === "IN_REVIEW" && (
            <>
              <button
                type="button"
                disabled={!!actionPending}
                onClick={() => doAction("approve")}
                className="fca-button-secondary text-emerald-700"
              >
                {isPending("approve") ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Genehmigen &amp; Veröffentlichen
              </button>
              <button
                type="button"
                disabled={!!actionPending}
                onClick={() => doAction("reject", { notes: reviewNotes || null })}
                className="fca-button-secondary text-rose-700"
              >
                {isPending("reject") ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Ablehnen / Änderung anfragen
              </button>
            </>
          )}

          {isEdit && !requiresReview && (
            <button
              type="button"
              onClick={() => doAction(status === "PUBLISHED" ? "unpublish" : "publish")}
              disabled={!!actionPending}
              className={
                status === "PUBLISHED"
                  ? "fca-button-secondary text-amber-700"
                  : "fca-button-secondary text-emerald-700"
              }
            >
              {isPending("publish") || isPending("unpublish") ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : status === "PUBLISHED" ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {status === "PUBLISHED" ? "Depublizieren" : "Veröffentlichen"}
            </button>
          )}

          {isEdit &&
            !requiresReview &&
            scheduledAtInput &&
            new Date(scheduledAtInput) > new Date() &&
            status !== "PUBLISHED" && (
              <button
                type="button"
                disabled={!!actionPending}
                onClick={() => doAction("publish")}
                className="fca-button-secondary text-amber-700"
              >
                {isPending("publish") ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
                Einplanen
              </button>
            )}
        </div>
      </div>

      {/* Right — sidebar */}
      <div className="space-y-6">
        {/* Status */}
        {isEdit && (
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Status
              </p>
            </div>
            <div className="sce-detail-section-body space-y-2">
              <HomepageBlockStatusBadge status={status} />
              {block?.publishedAt && (
                <p className="text-[11px] text-[var(--muted)]">
                  Veröffentlicht:{" "}
                  {new Intl.DateTimeFormat("de-CH", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(block.publishedAt))}
                </p>
              )}
              {isEdit && (
                <a
                  href="/dashboard/website/homepage/preview"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="fca-button-secondary text-xs inline-flex items-center gap-1.5 w-full justify-center"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Vorschau öffnen
                </a>
              )}
            </div>
          </div>
        )}

        {/* Scheduled publish */}
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Geplante Veröffentlichung
            </p>
          </div>
          <div className="sce-detail-section-body space-y-1.5">
            <input
              type="datetime-local"
              value={scheduledAtInput}
              onChange={(e) => setScheduledAtInput(e.target.value)}
              className="fca-input text-xs"
            />
            <p className="text-[10px] text-[var(--muted)]">
              Leer lassen für sofortige Veröffentlichung.
            </p>
          </div>
        </div>

        {/* Block type info */}
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Block-Typ
            </p>
          </div>
          <div className="sce-detail-section-body">
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)]">
              Hero
            </div>
            {isEdit && (
              <p className="mt-2 text-[10px] text-[var(--muted)]">
                Reihenfolge: Position {block?.sortOrder ?? 0}
              </p>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
