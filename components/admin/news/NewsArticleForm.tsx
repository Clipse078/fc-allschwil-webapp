"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff, Save } from "lucide-react";
import NewsHeroMediaPicker from "@/components/admin/news/NewsHeroMediaPicker";
import NewsStatusBadge from "@/components/admin/news/NewsStatusBadge";
import type { NewsArticleAdminDetail, ArticleStatus } from "@/lib/news/admin-queries";

type HeroMediaValue = {
  id: string;
  url: string;
  altText: string | null;
  filename: string;
} | null;

type NewsArticleFormProps = {
  /** Existing article for edit mode. Undefined = create mode. */
  article?: NewsArticleAdminDetail;
};

const labelClass =
  "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5";

export default function NewsArticleForm({ article }: NewsArticleFormProps) {
  const router = useRouter();
  const isEdit = Boolean(article);

  const [title, setTitle] = useState(article?.title ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? "");
  const [content, setContent] = useState(article?.content ?? "");
  const [authorName, setAuthorName] = useState(article?.authorName ?? "");
  const [heroMedia, setHeroMedia] = useState<HeroMediaValue>(
    article?.heroMedia ?? null,
  );

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
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
    return {
      title: title.trim(),
      slug: slug.trim(),
      excerpt: excerpt.trim() || null,
      content,
      authorName: authorName.trim() || null,
      heroMediaId: heroMedia?.id ?? null,
      imageUrl: heroMedia?.url ?? null,
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
      router.push(`/dashboard/website/news/${savedId}/edit`);
      router.refresh();
    } catch {
      setSaveError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublishToggle() {
    if (!article) return;
    setPublishing(true);
    setSaveError(null);
    try {
      const action = status === "PUBLISHED" ? "?action=unpublish" : "";
      const res = await fetch(`/api/news/${article.id}/publish${action}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveError(data?.error ?? "Fehler beim Statuswechsel."); return; }
      setStatus(data.article?.status as ArticleStatus);
      router.refresh();
    } catch {
      setSaveError("Netzwerkfehler.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="grid gap-8 lg:grid-cols-[1fr_320px]">
      {/* Left — main fields */}
      <div className="space-y-6">
        {/* Title */}
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
              <label className={labelClass}>Inhalt (Markdown)</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Artikelinhalt in Markdown…"
                rows={18}
                className="fca-input resize-y font-mono text-xs leading-relaxed"
              />
              <p className="mt-1 text-[10px] text-[var(--muted)]">
                Markdown wird auf der Website gerendert. Bilder können als
                {" "}
                <code className="rounded bg-[var(--surface-2)] px-1 py-0.5">![Alt](URL)</code>
                {" "}
                eingebettet werden. Videos via iframe-Link.
              </p>
            </div>
          </div>
        </div>

        {/* Errors */}
        {saveError && (
          <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {saveError}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="fca-button-primary"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Speichern…" : isEdit ? "Änderungen speichern" : "Entwurf erstellen"}
          </button>

          {isEdit && (
            <button
              type="button"
              onClick={handlePublishToggle}
              disabled={publishing}
              className={
                status === "PUBLISHED"
                  ? "fca-button-secondary text-amber-700"
                  : "fca-button-secondary text-emerald-700"
              }
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : status === "PUBLISHED" ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {publishing
                ? "…"
                : status === "PUBLISHED"
                ? "Depublizieren"
                : "Veröffentlichen"}
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
            <div className="sce-detail-section-body">
              <NewsStatusBadge status={status} />
              {article?.publishedAt && (
                <p className="mt-2 text-[11px] text-[var(--muted)]">
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
            </div>
          </div>
        )}

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

        {/* Author */}
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Autor
            </p>
          </div>
          <div className="sce-detail-section-body">
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Autorname (optional)"
              className="fca-input"
            />
          </div>
        </div>
      </div>
    </form>
  );
}
