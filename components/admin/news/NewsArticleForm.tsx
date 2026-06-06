"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  MessageSquare,
  Save,
  Send,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import NewsHeroMediaPicker from "@/components/admin/news/NewsHeroMediaPicker";
import NewsStatusBadge from "@/components/admin/news/NewsStatusBadge";
import NewsArticleGalleryPicker from "@/components/admin/news/NewsArticleGalleryPicker";
import { PeoplePicker } from "@/components/shared/PeoplePicker";
import type { PersonPickerResult } from "@/components/shared/PeoplePicker";
import type {
  NewsArticleAdminDetail,
  ArticleStatus,
  ArticleReviewStage,
  NewsArticleGalleryItem,
} from "@/lib/news/admin-queries";

// ── Types ─────────────────────────────────────────────────────────────────────

type HeroMediaValue = {
  id: string;
  url: string;
  altText: string | null;
  filename: string;
} | null;

type NewsArticleFormProps = {
  article?: NewsArticleAdminDetail;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const labelClass =
  "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5";

const REVIEW_STAGE_LABELS: Record<ArticleReviewStage, string> = {
  DRAFT: "Entwurf",
  SUBMITTED: "Zur Prüfung eingereicht",
  APPROVED: "Genehmigt",
  REJECTED: "Abgelehnt",
  PUBLISHED: "Veröffentlicht",
};

const REVIEW_STAGE_COLORS: Record<ArticleReviewStage, string> = {
  DRAFT: "text-[var(--muted)]",
  SUBMITTED: "text-amber-600",
  APPROVED: "text-emerald-600",
  REJECTED: "text-rose-600",
  PUBLISHED: "text-emerald-700",
};

// ── Helper ────────────────────────────────────────────────────────────────────

function toDatetimeLocal(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NewsArticleForm({ article }: NewsArticleFormProps) {
  const router = useRouter();
  const isEdit = Boolean(article);

  // Core fields
  const [title, setTitle] = useState(article?.title ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? "");
  const [content, setContent] = useState(article?.content ?? "");
  const [authorName, setAuthorName] = useState(article?.authorName ?? "");
  const [authorPerson, setAuthorPerson] = useState<PersonPickerResult | null>(null);
  const [heroMedia, setHeroMedia] = useState<HeroMediaValue>(article?.heroMedia ?? null);

  // Scheduling
  const [scheduledAt, setScheduledAt] = useState<string>(
    toDatetimeLocal(article?.scheduledAt),
  );

  // Review workflow
  const [reviewStage, setReviewStage] = useState<ArticleReviewStage>(
    (article?.reviewStage as ArticleReviewStage) ?? "DRAFT",
  );
  const [reviewNotes, setReviewNotes] = useState(article?.reviewNotes ?? "");
  const [showReviewPanel, setShowReviewPanel] = useState(false);

  // Gallery
  const [galleryItems] = useState<NewsArticleGalleryItem[]>(
    article?.galleryMedia ?? [],
  );

  // UI state
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [reviewWorking, setReviewWorking] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [status, setStatus] = useState<ArticleStatus>(
    (article?.status as ArticleStatus) ?? "DRAFT",
  );

  // ── Slug derivation ───────────────────────────────────────────────────────

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

  // ── Author from PeoplePicker ──────────────────────────────────────────────

  function handlePersonSelect(person: PersonPickerResult) {
    setAuthorPerson(person);
    const name = person.displayName || `${person.firstName} ${person.lastName}`;
    setAuthorName(name);
  }

  function handlePersonClear() {
    setAuthorPerson(null);
    // Keep the text field value as-is; user can edit manually
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  function buildPayload() {
    return {
      title: title.trim(),
      slug: slug.trim(),
      excerpt: excerpt.trim() || null,
      content,
      authorName: authorName.trim() || null,
      heroMediaId: heroMedia?.id ?? null,
      imageUrl: heroMedia?.url ?? null,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setSaveError("Titel ist erforderlich."); return; }
    setSaveError(null);
    setSaveSuccess(false);
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

      // Update derived status from server response
      if (data.article?.status) setStatus(data.article.status as ArticleStatus);

      const savedId: string = data.article?.id ?? article?.id;
      router.push(`/dashboard/website/news/${savedId}/edit`);
      router.refresh();
      setSaveSuccess(true);
    } catch {
      setSaveError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  // ── Publish toggle ────────────────────────────────────────────────────────

  async function handlePublishToggle() {
    if (!article) return;
    setPublishing(true);
    setSaveError(null);
    try {
      const action = status === "PUBLISHED" ? "?action=unpublish" : "";
      const res = await fetch(`/api/news/${article.id}/publish${action}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveError(data?.error ?? "Fehler beim Statuswechsel."); return; }
      const newStatus = data.article?.status as ArticleStatus;
      setStatus(newStatus);
      setReviewStage(data.article?.reviewStage as ArticleReviewStage ?? reviewStage);
      router.refresh();
    } catch {
      setSaveError("Netzwerkfehler.");
    } finally {
      setPublishing(false);
    }
  }

  // ── Review actions ────────────────────────────────────────────────────────

  async function handleReviewAction(action: "submit" | "approve" | "reject") {
    if (!article) return;
    setReviewWorking(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/news/${article.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reviewNotes: reviewNotes.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveError(data?.error ?? "Fehler beim Review-Workflow."); return; }
      setReviewStage(data.article?.reviewStage as ArticleReviewStage);
      setReviewNotes(data.article?.reviewNotes ?? "");
      router.refresh();
    } catch {
      setSaveError("Netzwerkfehler.");
    } finally {
      setReviewWorking(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSave} className="grid gap-8 lg:grid-cols-[1fr_320px]">
      {/* ── Left column — main content ── */}
      <div className="space-y-6">
        {/* Content section */}
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Inhalt</p>
          </div>
          <div className="sce-detail-section-body space-y-4">
            <div>
              <label className={labelClass}>Titel *</label>
              <input type="text" value={title} onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Artikeltitel" className="fca-input" required />
            </div>
            <div>
              <label className={labelClass}>Slug</label>
              <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)}
                placeholder="artikel-slug" className="fca-input font-mono text-xs" />
              <p className="mt-1 text-[10px] text-[var(--muted)]">
                Wird automatisch aus dem Titel abgeleitet. Muss pro Tenant eindeutig sein.
              </p>
            </div>
            <div>
              <label className={labelClass}>Teaser / Kurzbeschreibung</label>
              <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Kurze Zusammenfassung (wird in der Übersicht angezeigt)…"
                rows={3} className="fca-input resize-none" />
            </div>
            <div>
              <label className={labelClass}>Inhalt (Markdown)</label>
              <textarea value={content} onChange={(e) => setContent(e.target.value)}
                placeholder="Artikelinhalt in Markdown…"
                rows={18} className="fca-input resize-y font-mono text-xs leading-relaxed" />
              <p className="mt-1 text-[10px] text-[var(--muted)]">
                Markdown wird auf der Website gerendert. Bilder können als{" "}
                <code className="rounded bg-[var(--surface-2)] px-1 py-0.5">![Alt](URL)</code>{" "}
                eingebettet werden. Videos via iframe-Link.
              </p>
            </div>
          </div>
        </div>

        {/* Gallery section */}
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Galerie
            </p>
            <p className="text-[11px] text-[var(--muted)]">Mehrere Bilder zum Artikel</p>
          </div>
          <div className="sce-detail-section-body">
            <NewsArticleGalleryPicker
              articleId={article?.id}
              initialItems={galleryItems}
            />
          </div>
        </div>

        {/* Errors / Success */}
        {saveError && (
          <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {saveError}
          </div>
        )}
        {saveSuccess && !saving && (
          <div className="flex items-center gap-2 rounded-[var(--radius-xl)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Gespeichert.
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving} className="fca-button-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Speichern…" : isEdit ? "Änderungen speichern" : "Entwurf erstellen"}
          </button>

          {isEdit && (
            <button type="button" onClick={handlePublishToggle} disabled={publishing}
              className={status === "PUBLISHED" ? "fca-button-secondary text-amber-700" : "fca-button-secondary text-emerald-700"}>
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" />
                : status === "PUBLISHED" ? <EyeOff className="h-4 w-4" />
                : <Eye className="h-4 w-4" />}
              {publishing ? "…" : status === "PUBLISHED" ? "Depublizieren" : "Veröffentlichen"}
            </button>
          )}

          {/* Review workflow button (submit for review) */}
          {isEdit && reviewStage === "DRAFT" && (
            <button type="button" onClick={() => handleReviewAction("submit")} disabled={reviewWorking}
              className="fca-button-secondary text-amber-700">
              {reviewWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Zur Prüfung einreichen
            </button>
          )}
        </div>
      </div>

      {/* ── Right column — sidebar meta ── */}
      <div className="space-y-6">
        {/* Status */}
        {isEdit && (
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Status</p>
            </div>
            <div className="sce-detail-section-body space-y-3">
              <NewsStatusBadge status={status} />
              {article?.publishedAt && (
                <p className="text-[11px] text-[var(--muted)]">
                  Veröffentlicht:{" "}
                  {new Intl.DateTimeFormat("de-CH", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  }).format(new Date(article.publishedAt))}
                </p>
              )}
              {status === "SCHEDULED" && scheduledAt && (
                <p className="text-[11px] text-amber-600">
                  Geplant für:{" "}
                  {new Intl.DateTimeFormat("de-CH", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  }).format(new Date(scheduledAt))}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Review Workflow */}
        {isEdit && (
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Review</p>
              <button type="button" onClick={() => setShowReviewPanel(!showReviewPanel)}
                className="text-[11px] text-[var(--muted)] hover:text-[var(--foreground)]">
                {showReviewPanel ? "Ausblenden" : "Anzeigen"}
              </button>
            </div>
            <div className="sce-detail-section-body space-y-3">
              {/* Review stage badge */}
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${REVIEW_STAGE_COLORS[reviewStage]}`}>
                  {REVIEW_STAGE_LABELS[reviewStage]}
                </span>
              </div>

              {showReviewPanel && (
                <>
                  <div>
                    <label className={labelClass}>Review-Notizen</label>
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Feedback, Änderungswünsche…"
                      rows={3}
                      className="fca-input resize-none text-xs"
                    />
                  </div>

                  {/* Review actions */}
                  <div className="flex flex-wrap gap-2">
                    {reviewStage === "SUBMITTED" && (
                      <>
                        <button type="button" onClick={() => handleReviewAction("approve")} disabled={reviewWorking}
                          className="fca-button-secondary text-xs text-emerald-600">
                          {reviewWorking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
                          Genehmigen
                        </button>
                        <button type="button" onClick={() => handleReviewAction("reject")} disabled={reviewWorking}
                          className="fca-button-secondary text-xs text-rose-600">
                          {reviewWorking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsDown className="h-3.5 w-3.5" />}
                          Ablehnen
                        </button>
                      </>
                    )}
                    {reviewStage === "DRAFT" && (
                      <button type="button" onClick={() => handleReviewAction("submit")} disabled={reviewWorking}
                        className="fca-button-secondary text-xs text-amber-600">
                        {reviewWorking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Zur Prüfung einreichen
                      </button>
                    )}
                  </div>

                  {reviewNotes && reviewStage !== "DRAFT" && (
                    <div className="flex items-start gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
                      <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                      <p className="text-xs text-[var(--foreground)]">{reviewNotes}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Scheduled publishing */}
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Geplante Veröffentlichung
            </p>
          </div>
          <div className="sce-detail-section-body space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="fca-input text-xs"
              />
            </div>
            {scheduledAt && (
              <button type="button" onClick={() => setScheduledAt("")}
                className="flex items-center gap-1 text-[11px] text-rose-600 hover:underline">
                <X className="h-3 w-3" />Datum entfernen
              </button>
            )}
            <p className="text-[10px] text-[var(--muted)]">
              Leer lassen für sofortige Veröffentlichung. Ein Datum in der Zukunft setzt den Status auf SCHEDULED.
            </p>
          </div>
        </div>

        {/* Hero image */}
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Headerbild</p>
          </div>
          <div className="sce-detail-section-body">
            <NewsHeroMediaPicker value={heroMedia} onChange={setHeroMedia} />
          </div>
        </div>

        {/* Author — PeoplePicker */}
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Autor</p>
          </div>
          <div className="sce-detail-section-body space-y-3">
            {/* PeoplePicker fills authorName */}
            <div>
              <label className={labelClass}>Person wählen (optional)</label>
              <PeoplePicker
                selected={authorPerson}
                onSelect={handlePersonSelect}
                onClearSelected={handlePersonClear}
                placeholder="Person suchen…"
              />
            </div>
            {/* Manual text override */}
            <div>
              <label className={labelClass}>Autorname</label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Autorname (optional)"
                className="fca-input text-sm"
              />
              <p className="mt-1 text-[10px] text-[var(--muted)]">
                Wird durch PeoplePicker automatisch ausgefüllt. Kann manuell überschrieben werden.
              </p>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
