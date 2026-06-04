"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Globe } from "lucide-react";
import type { AdminNewsItem } from "@/lib/website/news-queries";

type WebsiteNewsFormProps = {
  /** When provided, the form is in edit mode. */
  post?: AdminNewsItem | null;
  tenantId: string;
};

export default function WebsiteNewsForm({ post, tenantId }: WebsiteNewsFormProps) {
  const router = useRouter();
  const isEdit = !!post;

  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [authorName, setAuthorName] = useState(post?.authorName ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(post?.coverImageUrl ?? "");
  const [isPublished, setIsPublished] = useState(post?.isPublished ?? false);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function generateSlug(value: string): string {
    return value
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!isEdit || !post?.slug) {
      setSlug(generateSlug(value));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Titel ist erforderlich.");
      return;
    }
    setIsSaving(true);
    setError(null);

    const payload = {
      title: title.trim(),
      slug: slug.trim() || generateSlug(title),
      excerpt: excerpt.trim() || null,
      bodyContent: body,
      authorName: authorName.trim() || null,
      coverImageUrl: coverImageUrl.trim() || null,
      isPublished,
    };

    try {
      const url = isEdit ? `/api/website/news/${post!.id}` : "/api/website/news";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error ?? "Fehler beim Speichern.");
        return;
      }

      router.push("/dashboard/admin/website/news");
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setIsSaving(false);
    }
  }

  void tenantId;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="fca-card space-y-5 p-6">
        <h3 className="fca-subheading">Artikel-Details</h3>

        {/* Title */}
        <div>
          <label className="fca-label" htmlFor="title">
            Titel <span className="text-rose-500">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Spielberichtsauftakt KW 23…"
            required
            className="fca-input mt-1 w-full"
          />
        </div>

        {/* Slug */}
        <div>
          <label className="fca-label" htmlFor="slug">
            URL-Slug
          </label>
          <div className="mt-1 flex items-center gap-2">
            <Globe className="h-4 w-4 shrink-0 text-[var(--muted)]" />
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              placeholder="spielbericht-kw-23"
              className="fca-input w-full font-mono text-sm"
            />
          </div>
          <p className="mt-1 text-[0.72rem] text-[var(--muted)]">
            Wird in der URL verwendet: /news/{slug || "…"}
          </p>
        </div>

        {/* Excerpt */}
        <div>
          <label className="fca-label" htmlFor="excerpt">
            Kurzbeschreibung
          </label>
          <textarea
            id="excerpt"
            rows={2}
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="Kurze Zusammenfassung für Listen und Social Media…"
            className="fca-input mt-1 w-full resize-none"
          />
        </div>

        {/* Author */}
        <div>
          <label className="fca-label" htmlFor="authorName">
            Autor
          </label>
          <input
            id="authorName"
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Max Muster"
            className="fca-input mt-1 w-full"
          />
        </div>

        {/* Cover image URL */}
        <div>
          <label className="fca-label" htmlFor="coverImageUrl">
            Titelbild-URL
          </label>
          <input
            id="coverImageUrl"
            type="url"
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            placeholder="https://…"
            className="fca-input mt-1 w-full"
          />
        </div>
      </div>

      {/* Article body */}
      <div className="fca-card space-y-3 p-6">
        <h3 className="fca-subheading">Inhalt</h3>
        <p className="text-[0.75rem] text-[var(--muted)]">
          Markdown wird unterstützt.
        </p>
        <textarea
          rows={16}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Artikel-Inhalt in Markdown…"
          className="fca-input w-full resize-y font-mono text-sm"
        />
      </div>

      {/* Publish toggle + submit */}
      <div className="fca-card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex cursor-pointer items-center gap-3">
          <div className="relative">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="sr-only"
            />
            <div
              className={`h-6 w-11 rounded-full transition-colors ${
                isPublished ? "bg-emerald-500" : "bg-slate-200"
              }`}
            />
            <div
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                isPublished ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </div>
          <span className="text-sm font-medium text-slate-700">
            {isPublished ? "Publiziert" : "Entwurf"}
          </span>
        </label>

        <button
          type="submit"
          disabled={isSaving}
          className="fca-button-primary flex items-center gap-2"
        >
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {isSaving ? "Speichert…" : isEdit ? "Änderungen speichern" : "Artikel erstellen"}
        </button>
      </div>
    </form>
  );
}
