"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
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
} from "lucide-react";
import NewsHeroMediaPicker from "@/components/admin/news/NewsHeroMediaPicker";
import NewsArticleMediaGallery from "@/components/admin/news/NewsArticleMediaGallery";
import NewsStatusBadge from "@/components/admin/news/NewsStatusBadge";
import { PeoplePicker, type PersonPickerResult } from "@/components/shared/PeoplePicker";
import type {
  NewsArticleAdminDetail,
  ArticleStatus,
  NewsArticleMediaItem,
} from "@/lib/news/admin-queries";
import { isRichTextValue, richTextToHtml, type RichTextValue } from "@/lib/cms/rich-text";

const RichTextEditor = dynamic(
  () => import("@/components/admin/cms/RichTextEditor"),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface-2)]" />
    ),
  },
);

type HeroMediaValue = {
  id: string;
  url: string;
  altText: string | null;
  filename: string;
} | null;

type NewsArticleFormProps = {
  /** Existing article for edit mode. Undefined = create mode. */
  article?: NewsArticleAdminDetail;
  /**
   * Whether the tenant requires editorial review before publishing.
   * When true, editors submit for review instead of publishing directly.
   * When false, direct publish is available.
   */
  requiresReview?: boolean;
};

const labelClass =
  "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5";

function toLocalDatetimeValue(date: Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  // Format as YYYY-MM-DDTHH:MM for <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export default function NewsArticleForm({
  article,
  requiresReview = false,
}: NewsArticleFormProps) {
  const router = useRouter();
  const isEdit = Boolean(article);

  const [title, setTitle] = useState(article?.title ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? "");
  const [content] = useState(article?.content ?? "");
  const [contentJson, setContentJson] = useState<RichTextValue | null>(
    isRichTextValue(article?.contentJson) ? (article.contentJson as RichTextValue) : null,
  );
  const [heroMedia, setHeroMedia] = useState<HeroMediaValue>(
    article?.heroMedia ?? null,
  );

  // Additional media
  const [additionalMedia, setAdditionalMedia] = useState<NewsArticleMediaItem[]>(
    article?.additionalMedia ?? [],
  );

  // Author — PeoplePicker-first, fallback to plain text
  const [authorPerson, setAuthorPerson] = useState<PersonPickerResult | null>(
    article?.authorPerson
      ? {
          id: article.authorPerson.id,
          firstName: article.authorPerson.firstName,
          lastName: article.authorPerson.lastName,
          displayName: article.authorPerson.displayName,
          email: null,
          phone: null,
        }
      : null,
  );

  // scheduledAt as local datetime string for the input
  const [scheduledAtInput, setScheduledAtInput] = useState<string>(
    toLocalDatetimeValue(article?.scheduledAt),
  );

  // Review notes (for rejection feedback)
  const [reviewNotes, setReviewNotes] = useState(article?.reviewNotes ?? "");

  const [saving, setSaving] = useState(false);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [status, setStatus] = useState<ArticleStatus>(
    (article?.status as ArticleStatus) ?? "DRAFT",
  );

  function deriveSlug(t: string) {
    return t
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  function handleTitleChange(val: string) {
    setTitle(val);
    if (!isEdit || !slug) setSlug(deriveSlug(val));
  }

  function buildPayload() {
    const scheduledAt = scheduledAtInput ? new Date(scheduledAtInput).toISOString() : null;

    // When contentJson is set, derive a backward-compatible HTML string for
    // consumers that still read the legacy `content` field.
    // When contentJson is absent, preserve the existing content string unchanged.
    const resolvedContent = contentJson ? richTextToHtml(contentJson) : content;

    return {
      title: title.trim(),
      slug: slug.trim(),
      excerpt: excerpt.trim() || null,
      content: resolvedContent,
      contentJson: contentJson ?? undefined,
      authorPersonId: authorPerson?.id ?? null,
      authorName: authorPerson
        ? (authorPerson.displayName || `${authorPerson.firstName} ${authorPerson.lastName}`)
        : null,
      heroMediaId: heroMedia?.id ?? null,
      imageUrl: heroMedia?.url ?? null,
      scheduledAt,
    };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setSaveError("Titel ist erforderlich."); return; }
    setSaveError(null);
    setSaving(true);
    try {
      const url = isEdit ? `/api/news/${article!.id}` : "/api/news";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveError(data?.error ?? "Fehler beim Speichern."); return; }

      const savedId: string = data.article?.id ?? article?.id;
      setStatus(data.article?.status as ArticleStatus ?? status);
      router.push(`/dashboard/website/news/${savedId}/edit`);
      router.refresh();
    } catch {
      setSaveError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  async function doAction(action: string, extraBody?: Record<string, unknown>) {
    if (!article) return;
    setActionPending(action);
    setSaveError(null);
    try {
      const suffix = action === "publish" ? "" : `?action=${action}`;
      const res = await fetch(`/api/news/${article.id}/publish${suffix}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(extraBody ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveError(data?.error ?? "Fehler beim Statuswechsel."); return; }
      setStatus(data.article?.status as ArticleStatus);
      router.refresh();
    } catch {
      setSaveError("Netzwerkfehler.");
    } finally {
      setActionPending(null);
    }
  }

  const isPending = (a: string) => actionPending === a;

  return (
    <form onSubmit={handleSave} className="grid gap-8 lg:grid-cols-[1fr_320px]">
      {/* Left — main fields */}
      <div className="space-y-6">
        {/* Content section */}
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Inhalt
            </p>
          </div>
          <div className="sce-detail-section-body space-y-4">
            <div>
              <label className={labelClass}>Titel *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Artikeltitel"
                className="fca-input"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="artikel-slug"
                className="fca-input font-mono text-xs"
              />
              <p className="mt-1 text-[10px] text-[var(--muted)]">
                Wird automatisch aus dem Titel abgeleitet. Muss pro Tenant eindeutig sein.
              </p>
            </div>
            <div>
              <label className={labelClass}>Teaser / Kurzbeschreibung</label>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Kurze Zusammenfassung (wird in der Übersicht angezeigt)…"
                rows={3}
                className="fca-input resize-none"
              />
            </div>
            <div>
              <label className={labelClass}>Inhalt</label>
              <RichTextEditor
                value={contentJson}
                onChange={setContentJson}
                placeholder="Artikelinhalt eingeben…"
              />
            </div>
          </div>
        </div>

        {/* Additional media gallery */}
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Weitere Medien (Galerie)
            </p>
          </div>
          <div className="sce-detail-section-body">
            <NewsArticleMediaGallery
              articleId={article?.id}
              items={additionalMedia}
              onItemsChange={setAdditionalMedia}
            />
          </div>
        </div>

        {/* Review notes (shown when article was rejected or is in review) */}
        {isEdit && (status === "DRAFT" || status === "IN_REVIEW") && (
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Prüfungsnotizen
              </p>
            </div>
            <div className="sce-detail-section-body">
              {article?.reviewNotes && (
                <div className="mb-3 rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide">
                    Feedback vom Prüfer
                  </p>
                  <p className="whitespace-pre-wrap text-xs">{article.reviewNotes}</p>
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
          {/* Save draft */}
          <button
            type="submit"
            disabled={saving}
            className="fca-button-primary"
          >
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
                onClick={() =>
                  doAction("reject", { notes: reviewNotes || null })
                }
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
              onClick={() =>
                doAction(status === "PUBLISHED" ? "unpublish" : "publish")
              }
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

          {/* Scheduled publish: only show when there's a future date and no review needed */}
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

      {/* Right — sidebar meta */}
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
              <NewsStatusBadge status={status} />
              {article?.publishedAt && (
                <p className="text-[11px] text-[var(--muted)]">
                  Veröffentlicht:{" "}
                  {new Intl.DateTimeFormat("de-CH", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(article.publishedAt))}
                </p>
              )}
              {article?.scheduledAt && status === "SCHEDULED" && (
                <p className="text-[11px] text-amber-600">
                  Geplant für:{" "}
                  {new Intl.DateTimeFormat("de-CH", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(article.scheduledAt))}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Publish date/time */}
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
              Leer lassen für sofortige Veröffentlichung. Datum in der Zukunft setzt
              Status auf &ldquo;Geplant&rdquo;.
            </p>
          </div>
        </div>

        {/* Hero image */}
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Headerbild
            </p>
          </div>
          <div className="sce-detail-section-body">
            <NewsHeroMediaPicker value={heroMedia} onChange={setHeroMedia} />
          </div>
        </div>

        {/* Author — PeoplePicker */}
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Autor
            </p>
          </div>
          <div className="sce-detail-section-body">
            <PeoplePicker
              mode="any"
              selected={authorPerson}
              onSelect={(p) => setAuthorPerson(p)}
              onClearSelected={() => setAuthorPerson(null)}
              placeholder="Person suchen…"
            />
            <p className="mt-1.5 text-[10px] text-[var(--muted)]">
              Suche nach Personen aus dem System. Der Anzeigename wird gespeichert.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}
