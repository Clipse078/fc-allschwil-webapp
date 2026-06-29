"use client";

/**
 * NewsArticleForm — CMS V4.2 Unified News Editor
 *
 * Replaces the legacy markdown textarea with a premium editing experience:
 *   - TipTap rich-text editor (shared RichTextEditor component)
 *   - Debounced autosave (1.5s) with visual indicator
 *   - Undo / Redo via TipTap history
 *   - Inspector sidebar (status, scheduling, hero image, author, SEO)
 *   - Revision history panel with restore
 *   - Shared workflow/publishing actions
 *   - Live preview toggle (opens public URL in new tab)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Loader2,
  Eye,
  EyeOff,
  Save,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Undo2,
  Redo2,
  History,
  ChevronRight,
  X,
  Search,
  Globe,
  PenLine,
  Tag,
  RotateCcw,
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
import type { RichTextValue } from "@/lib/cms/rich-text";

// Lazy-load TipTap to avoid SSR issues
const RichTextEditor = dynamic(
  () => import("@/components/admin/cms/RichTextEditor"),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface-2)]" />
    ),
  },
);

// ── Types ─────────────────────────────────────────────────────────────────────

type HeroMediaValue = {
  id: string;
  url: string;
  altText: string | null;
  filename: string;
} | null;

type RevisionItem = {
  id: string;
  versionNumber: number;
  changeNote: string | null;
  createdAt: string;
  isRestore: boolean;
  createdByUserId: string | null;
};

type SaveState = "idle" | "saving" | "saved" | "error";

type NewsArticleFormProps = {
  article?: NewsArticleAdminDetail;
  requiresReview?: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// ── Save indicator ────────────────────────────────────────────────────────────

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const map: Record<SaveState, { label: string; color: string; icon: React.ReactNode }> = {
    idle: { label: "", color: "", icon: null },
    saving: {
      label: "Speichern…",
      color: "text-[var(--muted)]",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    saved: {
      label: "Gespeichert",
      color: "text-emerald-600",
      icon: <CheckCircle className="h-3 w-3" />,
    },
    error: {
      label: "Fehler beim Speichern",
      color: "text-rose-600",
      icon: <XCircle className="h-3 w-3" />,
    },
  };
  const { label, color, icon } = map[state];
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${color}`}>
      {icon}
      {label}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function NewsArticleForm({
  article,
  requiresReview = false,
}: NewsArticleFormProps) {
  const router = useRouter();
  const isEdit = Boolean(article);

  // ── Content state
  const [title, setTitle] = useState(article?.title ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? "");
  const [contentJson, setContentJson] = useState<RichTextValue | null>(
    (article?.contentJson as RichTextValue) ?? null,
  );
  const [heroMedia, setHeroMedia] = useState<HeroMediaValue>(
    article?.heroMedia ?? null,
  );
  const [additionalMedia, setAdditionalMedia] = useState<NewsArticleMediaItem[]>(
    article?.additionalMedia ?? [],
  );

  // ── Meta state
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
  const [scheduledAtInput, setScheduledAtInput] = useState<string>(
    toLocalDatetimeValue(article?.scheduledAt),
  );
  const [seoTitle, setSeoTitle] = useState(article?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(article?.seoDescription ?? "");

  // ── Workflow state
  const [reviewNotes, setReviewNotes] = useState(article?.reviewNotes ?? "");
  const [status, setStatus] = useState<ArticleStatus>(
    (article?.status as ArticleStatus) ?? "DRAFT",
  );
  const [tags, setTags] = useState<string[]>(
    Array.isArray(article?.tags) ? (article.tags as string[]) : [],
  );
  const [tagInput, setTagInput] = useState("");

  // ── UI state
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [manualSaving, setManualSaving] = useState(false);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<RevisionItem[]>([]);
  const [showRevisions, setShowRevisions] = useState(false);
  const [activePanel, setActivePanel] = useState<"meta" | "seo" | "media">("meta");

  // Autosave ref
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);

  // ── Autosave logic
  const triggerAutosave = useCallback(() => {
    if (!isEdit || !article?.id) return;
    isDirtyRef.current = true;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setSaveState("saving");
    autosaveTimerRef.current = setTimeout(async () => {
      if (!isDirtyRef.current) return;
      isDirtyRef.current = false;
      await performSave({ autosave: true });
    }, 1500);
  }, [isEdit, article?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, []);

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
    triggerAutosave();
  }

  function handleContentChange(val: RichTextValue) {
    setContentJson(val);
    triggerAutosave();
  }

  function buildPayload() {
    const scheduledAt = scheduledAtInput ? new Date(scheduledAtInput).toISOString() : null;
    return {
      title: title.trim(),
      slug: slug.trim(),
      excerpt: excerpt.trim() || null,
      content: "", // kept for backward-compat; empty when using rich text
      contentJson: contentJson ?? null,
      authorPersonId: authorPerson?.id ?? null,
      authorName: authorPerson
        ? (authorPerson.displayName || `${authorPerson.firstName} ${authorPerson.lastName}`)
        : null,
      heroMediaId: heroMedia?.id ?? null,
      imageUrl: heroMedia?.url ?? null,
      scheduledAt,
      tags: tags.length > 0 ? tags : null,
      seoTitle: seoTitle.trim() || null,
      seoDescription: seoDescription.trim() || null,
    };
  }

  async function performSave(opts?: { autosave?: boolean }): Promise<boolean> {
    if (!title.trim()) {
      if (!opts?.autosave) setSaveError("Titel ist erforderlich.");
      setSaveState("error");
      return false;
    }
    setSaveError(null);
    if (!opts?.autosave) setManualSaving(true);
    setSaveState("saving");
    try {
      const url = isEdit ? `/api/news/${article!.id}` : "/api/news";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data?.error ?? "Fehler beim Speichern.");
        setSaveState("error");
        return false;
      }
      const savedId: string = data.article?.id ?? article?.id;
      setStatus(data.article?.status as ArticleStatus ?? status);
      setSaveState("saved");
      if (!opts?.autosave) {
        router.push(`/dashboard/website/news/${savedId}/edit`);
        router.refresh();
      }
      setTimeout(() => setSaveState("idle"), 3000);
      return true;
    } catch {
      setSaveError("Netzwerkfehler. Bitte erneut versuchen.");
      setSaveState("error");
      return false;
    } finally {
      if (!opts?.autosave) setManualSaving(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await performSave();
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

  async function loadRevisions() {
    if (!article?.id) return;
    try {
      const res = await fetch(
        `/api/content-revisions?entityType=NewsArticle&entityId=${article.id}&limit=20`,
      );
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      setRevisions(data.revisions ?? []);
    } catch { /* silent */ }
  }

  async function restoreRevision(revisionId: string) {
    if (!article?.id) return;
    try {
      const res = await fetch(
        `/api/content-revisions/${revisionId}/restore`,
        { method: "POST" },
      );
      if (!res.ok) return;
      router.refresh();
    } catch { /* silent */ }
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !tags.includes(t)) {
      const next = [...tags, t];
      setTags(next);
      triggerAutosave();
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((x) => x !== tag));
    triggerAutosave();
  }

  const isPending = (a: string) => actionPending === a;

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-0 min-h-0">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-6 py-3">
        <div className="flex items-center gap-3">
          {/* Status */}
          {isEdit && <NewsStatusBadge status={status} />}

          {/* Autosave indicator */}
          <SaveIndicator state={saveState} />
        </div>

        <div className="flex items-center gap-2">
          {/* Revision History */}
          {isEdit && (
            <button
              type="button"
              onClick={() => {
                setShowRevisions((v) => !v);
                if (!showRevisions) loadRevisions();
              }}
              className="fca-button-ghost flex items-center gap-1.5 text-xs"
            >
              <History className="h-3.5 w-3.5" />
              Versionen
            </button>
          )}

          {/* Save / Create */}
          <button
            type="submit"
            disabled={manualSaving}
            className="fca-button-primary flex items-center gap-2 text-sm"
          >
            {manualSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {manualSaving ? "Speichern…" : isEdit ? "Speichern" : "Entwurf erstellen"}
          </button>

          {/* Workflow actions */}
          {isEdit && requiresReview && status === "DRAFT" && (
            <button
              type="button"
              disabled={!!actionPending}
              onClick={() => doAction("submit")}
              className="fca-button-secondary flex items-center gap-2 text-sm text-blue-700"
            >
              {isPending("submit") ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Zur Prüfung
            </button>
          )}
          {isEdit && requiresReview && status === "IN_REVIEW" && (
            <>
              <button
                type="button"
                disabled={!!actionPending}
                onClick={() => doAction("approve")}
                className="fca-button-secondary flex items-center gap-2 text-sm text-emerald-700"
              >
                {isPending("approve") ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Genehmigen
              </button>
              <button
                type="button"
                disabled={!!actionPending}
                onClick={() => doAction("reject", { notes: reviewNotes || null })}
                className="fca-button-secondary flex items-center gap-2 text-sm text-rose-700"
              >
                {isPending("reject") ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Ablehnen
              </button>
            </>
          )}
          {isEdit && !requiresReview && (
            <button
              type="button"
              onClick={() => doAction(status === "PUBLISHED" ? "unpublish" : "publish")}
              disabled={!!actionPending}
              className={[
                "fca-button-secondary flex items-center gap-2 text-sm",
                status === "PUBLISHED" ? "text-amber-700" : "text-emerald-700",
              ].join(" ")}
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
          {isEdit && !requiresReview && scheduledAtInput && new Date(scheduledAtInput) > new Date() && status !== "PUBLISHED" && (
            <button
              type="button"
              disabled={!!actionPending}
              onClick={() => doAction("publish")}
              className="fca-button-secondary flex items-center gap-2 text-sm text-amber-700"
            >
              {isPending("publish") ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
              Einplanen
            </button>
          )}
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────────── */}
      {saveError && (
        <div className="mx-6 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {saveError}
        </div>
      )}

      {/* ── Review notes banner ───────────────────────────────────────────────── */}
      {isEdit && article?.reviewNotes && (status === "DRAFT" || status === "IN_REVIEW") && (
        <div className="mx-6 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 mb-1">
            Feedback vom Prüfer
          </p>
          <p className="text-xs text-amber-800 whitespace-pre-wrap">{article.reviewNotes}</p>
        </div>
      )}

      {/* ── Main content area ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — editor */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title */}
          <div>
            <label className={labelClass}>Titel *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Artikeltitel"
              className="fca-input text-lg font-semibold"
              required
            />
          </div>

          {/* Slug */}
          <div>
            <label className={labelClass}>Slug (URL-Pfad)</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => { setSlug(e.target.value); triggerAutosave(); }}
              placeholder="artikel-slug"
              className="fca-input font-mono text-xs"
            />
            <p className="mt-1 text-[10px] text-[var(--muted)]">
              Wird automatisch aus dem Titel abgeleitet. Muss pro Tenant eindeutig sein.
            </p>
          </div>

          {/* Excerpt */}
          <div>
            <label className={labelClass}>Teaser / Kurzbeschreibung</label>
            <textarea
              value={excerpt}
              onChange={(e) => { setExcerpt(e.target.value); triggerAutosave(); }}
              placeholder="Kurze Zusammenfassung (wird in der Übersicht angezeigt)…"
              rows={3}
              className="fca-input resize-none"
            />
          </div>

          {/* Rich text body */}
          <div>
            <label className={labelClass}>Inhalt</label>
            <RichTextEditor
              value={contentJson}
              onChange={handleContentChange}
              placeholder="Artikelinhalt eingeben…"
              className="min-h-[320px]"
            />
          </div>

          {/* Tags */}
          <div>
            <label className={labelClass}>Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--text-2)]"
                >
                  <Tag className="h-2.5 w-2.5" />
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-0.5 text-[var(--muted)] hover:text-rose-500 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addTag(); }
                }}
                placeholder="Tag hinzufügen…"
                className="fca-input text-xs"
              />
              <button
                type="button"
                onClick={addTag}
                className="fca-button-secondary text-xs"
              >
                Hinzufügen
              </button>
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

          {/* Review notes input (for reviewers rejecting an article) */}
          {isEdit && requiresReview && status === "IN_REVIEW" && (
            <div className="sce-detail-section">
              <div className="sce-detail-section-header">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Prüfungsnotizen
                </p>
              </div>
              <div className="sce-detail-section-body">
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Feedback / Änderungsanfrage (optional)…"
                  rows={3}
                  className="fca-input resize-none text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Inspector sidebar ─────────────────────────────────────────────── */}
        <aside className="w-72 shrink-0 overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)]">
          {/* Panel tabs */}
          <div className="flex border-b border-[var(--border)]">
            {(["meta", "seo", "media"] as const).map((panel) => (
              <button
                key={panel}
                type="button"
                onClick={() => setActivePanel(panel)}
                className={[
                  "flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-wide transition-colors",
                  activePanel === panel
                    ? "border-b-2 border-[var(--accent)] text-[var(--accent)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]",
                ].join(" ")}
              >
                {panel === "meta" ? "Details" : panel === "seo" ? "SEO" : "Medien"}
              </button>
            ))}
          </div>

          {/* Meta panel */}
          {activePanel === "meta" && (
            <div className="space-y-5 p-4">
              {/* Status */}
              {isEdit && (
                <div>
                  <p className={labelClass}>Status</p>
                  <NewsStatusBadge status={status} />
                  {article?.publishedAt && (
                    <p className="mt-1.5 text-[11px] text-[var(--muted)]">
                      Veröffentlicht: {fmtDateTime(new Date(article.publishedAt).toISOString())}
                    </p>
                  )}
                  {article?.scheduledAt && status === "SCHEDULED" && (
                    <p className="mt-1 text-[11px] text-amber-600">
                      Geplant: {fmtDateTime(new Date(article.scheduledAt).toISOString())}
                    </p>
                  )}
                </div>
              )}

              {/* Scheduled publish */}
              <div>
                <label className={labelClass}>Geplante Veröffentlichung</label>
                <input
                  type="datetime-local"
                  value={scheduledAtInput}
                  onChange={(e) => { setScheduledAtInput(e.target.value); triggerAutosave(); }}
                  className="fca-input text-xs"
                />
                <p className="mt-1 text-[10px] text-[var(--muted)]">
                  Leer = sofortige Veröffentlichung.
                </p>
              </div>

              {/* Author */}
              <div>
                <label className={labelClass}>Autor</label>
                <PeoplePicker
                  mode="any"
                  selected={authorPerson}
                  onSelect={(p) => { setAuthorPerson(p); triggerAutosave(); }}
                  onClearSelected={() => { setAuthorPerson(null); triggerAutosave(); }}
                  placeholder="Person suchen…"
                />
              </div>

              {/* Article slug (read-only copy) */}
              {isEdit && article?.id && (
                <div>
                  <p className={labelClass}>Artikel-ID</p>
                  <p className="font-mono text-[10px] text-[var(--muted)] break-all">{article.id}</p>
                </div>
              )}
            </div>
          )}

          {/* SEO panel */}
          {activePanel === "seo" && (
            <div className="space-y-5 p-4">
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                <p className="text-[11px] text-blue-700 font-medium flex items-center gap-1.5">
                  <Globe className="h-3 w-3" />
                  SEO-Felder für diesen Artikel
                </p>
                <p className="mt-0.5 text-[10px] text-blue-600">
                  Überschreibt die globalen Website-Defaults.
                </p>
              </div>

              <div>
                <label className={labelClass}>SEO-Titel</label>
                <input
                  type="text"
                  value={seoTitle}
                  onChange={(e) => { setSeoTitle(e.target.value); triggerAutosave(); }}
                  placeholder={title || "Artikeltitel"}
                  className="fca-input text-xs"
                  maxLength={70}
                />
                <p className="mt-1 text-[10px] text-[var(--muted)]">
                  {seoTitle.length}/70 Zeichen
                </p>
              </div>

              <div>
                <label className={labelClass}>Meta Description</label>
                <textarea
                  value={seoDescription}
                  onChange={(e) => { setSeoDescription(e.target.value); triggerAutosave(); }}
                  placeholder={excerpt || "Kurzbeschreibung für Suchmaschinen…"}
                  rows={3}
                  className="fca-input resize-none text-xs"
                  maxLength={160}
                />
                <p className="mt-1 text-[10px] text-[var(--muted)]">
                  {seoDescription.length}/160 Zeichen
                </p>
              </div>

              {/* Google preview */}
              {(seoTitle || title) && (
                <div>
                  <p className={labelClass}>Google-Vorschau</p>
                  <div className="rounded-lg border border-[var(--border)] bg-white p-3 text-left">
                    <p className="text-[13px] font-medium text-blue-700 truncate">
                      {seoTitle || title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-green-700 truncate">
                      www.website.ch/news/{slug || "artikel-slug"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--text-2)] line-clamp-2">
                      {seoDescription || excerpt || "Keine Beschreibung vorhanden."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Media panel */}
          {activePanel === "media" && (
            <div className="space-y-5 p-4">
              <div>
                <label className={labelClass}>Headerbild</label>
                <NewsHeroMediaPicker value={heroMedia} onChange={(v) => { setHeroMedia(v); triggerAutosave(); }} />
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* ── Revision history panel ─────────────────────────────────────────────── */}
      {showRevisions && (
        <div className="fixed inset-y-0 right-0 z-50 flex w-80 flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-[var(--muted)]" />
              <span className="text-sm font-semibold">Versionshistorie</span>
            </div>
            <button
              type="button"
              onClick={() => setShowRevisions(false)}
              className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {revisions.length === 0 ? (
              <div className="py-8 text-center">
                <PenLine className="mx-auto mb-2 h-6 w-6 text-[var(--muted)]" />
                <p className="text-xs text-[var(--muted)]">Noch keine Versionen.</p>
                <p className="mt-1 text-[10px] text-[var(--muted)]">
                  Versionen werden beim Speichern erstellt.
                </p>
              </div>
            ) : (
              revisions.map((rev) => (
                <div
                  key={rev.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-[var(--foreground)]">
                        Version {rev.versionNumber}
                        {rev.isRestore && (
                          <span className="ml-1.5 text-[10px] text-amber-600">(Wiederhergestellt)</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                        {fmtDateTime(rev.createdAt)}
                      </p>
                      {rev.changeNote && (
                        <p className="mt-1 text-[10px] text-[var(--text-2)] italic">{rev.changeNote}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => restoreRevision(rev.id)}
                      className="flex shrink-0 items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[10px] font-medium text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)] transition-colors"
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                      Wiederherstellen
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </form>
  );
}
