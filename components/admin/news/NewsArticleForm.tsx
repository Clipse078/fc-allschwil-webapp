"use client";

/**
 * NewsArticleForm — CMS V4.2 upgrade
 *
 * Tabs: Content | SEO | Media | Revisions
 * Content body: upgraded from Markdown textarea → shared RichTextEditor (TipTap).
 * Autosave: 2 s debounce on any field change in edit mode.
 * Revision panel: shows recent ContentRevision records via /api/content-revisions.
 * Publishing workflow: unchanged — thin adapters around existing /api/news/[id]/publish.
 * No second editor or parallel media picker introduced.
 */

import { useState, useEffect, useRef, useCallback } from "react";
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
  FileText,
  Image as ImageIcon,
  Search,
  History,
  CheckCircle2,
} from "lucide-react";
import RichTextEditor from "@/components/admin/cms/RichTextEditor";
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

// ── Types ─────────────────────────────────────────────────────────────────────

type HeroMediaValue = {
  id: string;
  url: string;
  altText: string | null;
  filename: string;
} | null;

type NewsArticleFormProps = {
  article?: NewsArticleAdminDetail;
  requiresReview?: boolean;
};

type EditorTab = "content" | "seo" | "media" | "revisions";

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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[äÄ]/g, "ae")
    .replace(/[öÖ]/g, "oe")
    .replace(/[üÜ]/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

function TabBar({
  active,
  onChange,
}: {
  active: EditorTab;
  onChange: (t: EditorTab) => void;
}) {
  const tabs: { id: EditorTab; label: string; icon: React.ReactNode }[] = [
    { id: "content", label: "Inhalt", icon: <FileText className="h-3.5 w-3.5" /> },
    { id: "seo", label: "SEO", icon: <Search className="h-3.5 w-3.5" /> },
    { id: "media", label: "Medien", icon: <ImageIcon className="h-3.5 w-3.5" /> },
    { id: "revisions", label: "Revisionen", icon: <History className="h-3.5 w-3.5" /> },
  ];
  return (
    <div className="flex gap-1 border-b border-[var(--border)] pb-0">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={[
            "flex items-center gap-1.5 border-b-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors",
            active === t.id
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]",
          ].join(" ")}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NewsArticleForm({
  article,
  requiresReview = false,
}: NewsArticleFormProps) {
  const router = useRouter();
  const isEdit = Boolean(article);

  // Core content state
  const [title, setTitle] = useState(article?.title ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? "");

  // Rich text body — prefer richContent (TipTap JSON), fall back to empty doc
  const [richContent, setRichContent] = useState<RichTextValue | null>(
    (article?.richContent as RichTextValue | null) ?? null,
  );

  // Hero + gallery media — reuse shared NewsHeroMediaPicker and NewsArticleMediaGallery
  const [heroMedia, setHeroMedia] = useState<HeroMediaValue>(article?.heroMedia ?? null);
  const [additionalMedia, setAdditionalMedia] = useState<NewsArticleMediaItem[]>(
    article?.additionalMedia ?? [],
  );

  // Author
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

  // Scheduling
  const [scheduledAtInput, setScheduledAtInput] = useState<string>(
    toLocalDatetimeValue(article?.scheduledAt),
  );

  // SEO fields
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");

  // Review notes
  const [reviewNotes, setReviewNotes] = useState(article?.reviewNotes ?? "");

  // UI state
  const [activeTab, setActiveTab] = useState<EditorTab>("content");
  const [saving, setSaving] = useState(false);
  const [autosaving, setAutosaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [status, setStatus] = useState<ArticleStatus>(
    (article?.status as ArticleStatus) ?? "DRAFT",
  );

  // Autosave
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirty = useRef(false);

  const markDirty = useCallback(() => {
    isDirty.current = true;
  }, []);

  function handleTitleChange(val: string) {
    setTitle(val);
    if (!isEdit || !slug) setSlug(slugify(val));
    markDirty();
  }

  function handleRichContentChange(val: RichTextValue) {
    setRichContent(val);
    markDirty();
  }

  // Debounced autosave — only in edit mode
  useEffect(() => {
    if (!isEdit || !article?.id) return;
    if (!isDirty.current) return;

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      if (!isDirty.current) return;
      isDirty.current = false;
      setAutosaving(true);
      try {
        const scheduledAt = scheduledAtInput ? new Date(scheduledAtInput).toISOString() : null;
        await fetch(`/api/news/${article.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim() || undefined,
            slug: slug.trim() || undefined,
            excerpt: excerpt.trim() || null,
            richContent: richContent ?? null,
            content: excerpt, // keep legacy field in sync with excerpt as fallback
            heroMediaId: heroMedia?.id ?? null,
            scheduledAt,
            authorPersonId: authorPerson?.id ?? null,
            authorName: authorPerson
              ? (authorPerson.displayName || `${authorPerson.firstName} ${authorPerson.lastName}`)
              : null,
          }),
        });
        setLastSaved(new Date());
      } finally {
        setAutosaving(false);
      }
    }, 2000);

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, slug, excerpt, richContent, heroMedia, scheduledAtInput, authorPerson]);

  function buildPayload() {
    const scheduledAt = scheduledAtInput ? new Date(scheduledAtInput).toISOString() : null;
    return {
      title: title.trim(),
      slug: slug.trim(),
      excerpt: excerpt.trim() || null,
      richContent: richContent ?? null,
      content: excerpt.trim() || "", // backward-compat: keep legacy content field
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
    isDirty.current = false;
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
      setLastSaved(new Date());
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
      {/* ── Left — main editor ───────────────────────────────────────────── */}
      <div className="space-y-6">
        {/* Tab bar */}
        <TabBar active={activeTab} onChange={setActiveTab} />

        {/* ── Tab: Content ─────────────────────────────────────────────── */}
        {activeTab === "content" && (
          <div className="space-y-4">
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
                    onChange={(e) => { setSlug(e.target.value); markDirty(); }}
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
                    onChange={(e) => { setExcerpt(e.target.value); markDirty(); }}
                    placeholder="Kurze Zusammenfassung (wird in der Übersicht angezeigt)…"
                    rows={3}
                    className="fca-input resize-none"
                  />
                </div>
                <div>
                  <label className={labelClass}>Artikelinhalt</label>
                  {/* Reuses shared RichTextEditor — no second editor introduced */}
                  <RichTextEditor
                    value={richContent}
                    onChange={handleRichContentChange}
                    placeholder="Artikelinhalt verfassen…"
                  />
                  <p className="mt-1 text-[10px] text-[var(--muted)]">
                    Formatierter Text: Überschriften, Fettschrift, Listen, Links, Zitate.
                  </p>
                </div>
              </div>
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
          </div>
        )}

        {/* ── Tab: SEO ─────────────────────────────────────────────────── */}
        {activeTab === "seo" && (
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                SEO-Metadaten
              </p>
            </div>
            <div className="sce-detail-section-body space-y-4">
              <div>
                <label className={labelClass}>SEO-Titel</label>
                <input
                  type="text"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder="Seiten-Titel für Suchmaschinen (leer = Artikeltitel)"
                  maxLength={70}
                  className="fca-input"
                />
                <p className="mt-1 text-[10px] text-[var(--muted)]">
                  Empfohlen: max. 60 Zeichen. ({seoTitle.length}/70)
                </p>
              </div>
              <div>
                <label className={labelClass}>Meta-Beschreibung</label>
                <textarea
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  placeholder="Kurzbeschreibung für Suchmaschinen-Vorschau (leer = Teaser)"
                  maxLength={160}
                  rows={3}
                  className="fca-input resize-none"
                />
                <p className="mt-1 text-[10px] text-[var(--muted)]">
                  Empfohlen: 120–160 Zeichen. ({seoDescription.length}/160)
                </p>
              </div>
              <div>
                <label className={labelClass}>Kanonische URL</label>
                <input
                  type="url"
                  placeholder="https://… (leer = Standard-URL des Artikels)"
                  className="fca-input text-xs"
                />
              </div>
              <p className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[10px] text-[var(--muted)]">
                SEO-Felder werden im nächsten Schritt in der Datenbank gespeichert
                (V4.2 Phase 2 — NewsArticle SEO-Felder).
              </p>
            </div>
          </div>
        )}

        {/* ── Tab: Media ───────────────────────────────────────────────── */}
        {activeTab === "media" && (
          <div className="space-y-6">
            {/* Hero image — reuses shared NewsHeroMediaPicker */}
            <div className="sce-detail-section">
              <div className="sce-detail-section-header">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Headerbild
                </p>
              </div>
              <div className="sce-detail-section-body">
                <NewsHeroMediaPicker value={heroMedia} onChange={(v) => { setHeroMedia(v); markDirty(); }} />
              </div>
            </div>

            {/* Gallery — reuses shared NewsArticleMediaGallery */}
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
          </div>
        )}

        {/* ── Tab: Revisions ───────────────────────────────────────────── */}
        {activeTab === "revisions" && (
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Revisionsverlauf
              </p>
            </div>
            <div className="sce-detail-section-body">
              {!isEdit ? (
                <p className="text-xs text-[var(--muted)]">
                  Revisionen sind nach dem ersten Speichern verfügbar.
                </p>
              ) : (
                <RevisionPanel articleId={article!.id} />
              )}
            </div>
          </div>
        )}

        {/* ── Errors + actions ────────────────────────────────────────── */}
        {saveError && (
          <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {saveError}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving} className="fca-button-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Speichern…" : isEdit ? "Speichern" : "Entwurf erstellen"}
          </button>

          {isEdit && requiresReview && status === "DRAFT" && (
            <button
              type="button"
              disabled={!!actionPending}
              onClick={() => doAction("submit")}
              className="fca-button-secondary text-blue-700"
            >
              {isPending("submit") ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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
                {isPending("approve") ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Genehmigen &amp; Veröffentlichen
              </button>
              <button
                type="button"
                disabled={!!actionPending}
                onClick={() => doAction("reject", { notes: reviewNotes || null })}
                className="fca-button-secondary text-rose-700"
              >
                {isPending("reject") ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Ablehnen / Änderung anfragen
              </button>
            </>
          )}

          {isEdit && !requiresReview && (
            <button
              type="button"
              onClick={() => doAction(status === "PUBLISHED" ? "unpublish" : "publish")}
              disabled={!!actionPending}
              className={status === "PUBLISHED" ? "fca-button-secondary text-amber-700" : "fca-button-secondary text-emerald-700"}
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
              className="fca-button-secondary text-amber-700"
            >
              {isPending("publish") ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
              Einplanen
            </button>
          )}

          {/* Autosave indicator */}
          {isEdit && (
            <span className="ml-auto flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
              {autosaving ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Automatisch speichern…
                </>
              ) : lastSaved ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  Gespeichert{" "}
                  {new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit" }).format(lastSaved)}
                </>
              ) : null}
            </span>
          )}
        </div>
      </div>

      {/* ── Right — sidebar ─────────────────────────────────────────────── */}
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
                    day: "2-digit", month: "2-digit", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  }).format(new Date(article.publishedAt))}
                </p>
              )}
              {article?.scheduledAt && status === "SCHEDULED" && (
                <p className="text-[11px] text-amber-600">
                  Geplant für:{" "}
                  {new Intl.DateTimeFormat("de-CH", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  }).format(new Date(article.scheduledAt))}
                </p>
              )}
              {status === "EXPIRED" && (
                <p className="text-[11px] text-rose-600">
                  Inhalt abgelaufen — nicht mehr öffentlich sichtbar.
                </p>
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
              onChange={(e) => { setScheduledAtInput(e.target.value); markDirty(); }}
              className="fca-input text-xs"
            />
            <p className="text-[10px] text-[var(--muted)]">
              Leer lassen für sofortige Veröffentlichung.
            </p>
          </div>
        </div>

        {/* Hero image — also shown in the sidebar for quick access */}
        {activeTab !== "media" && (
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Headerbild
              </p>
            </div>
            <div className="sce-detail-section-body">
              <NewsHeroMediaPicker value={heroMedia} onChange={(v) => { setHeroMedia(v); markDirty(); }} />
            </div>
          </div>
        )}

        {/* Author */}
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
              onSelect={(p) => { setAuthorPerson(p); markDirty(); }}
              onClearSelected={() => { setAuthorPerson(null); markDirty(); }}
              placeholder="Person suchen…"
            />
          </div>
        </div>
      </div>
    </form>
  );
}

// ── Revision panel ─────────────────────────────────────────────────────────────

function RevisionPanel({ articleId }: { articleId: string }) {
  const [revisions, setRevisions] = useState<Array<{
    id: string;
    versionNumber: number;
    createdAt: string;
    createdByName: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/content-revisions?entityType=NewsArticle&entityId=${articleId}`)
      .then((r) => r.json())
      .then((d) => setRevisions(d.revisions ?? []))
      .catch(() => setRevisions([]))
      .finally(() => setLoading(false));
  }, [articleId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Lade Revisionen…
      </div>
    );
  }

  if (revisions.length === 0) {
    return (
      <p className="text-xs text-[var(--muted)]">
        Noch keine Revisionen gespeichert. Revisionen werden bei manuellen Speicherungen erstellt.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {revisions.map((rev) => (
        <li
          key={rev.id}
          className="flex items-center justify-between gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs"
        >
          <span className="font-medium text-[var(--foreground)]">
            Version {rev.versionNumber}
          </span>
          <span className="text-[var(--muted)]">
            {new Intl.DateTimeFormat("de-CH", {
              day: "2-digit", month: "2-digit", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            }).format(new Date(rev.createdAt))}
            {rev.createdByName ? ` · ${rev.createdByName}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
