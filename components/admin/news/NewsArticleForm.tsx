"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Globe, EyeOff, Archive, AlertCircle } from "lucide-react";
import ImageUploadField from "@/components/admin/news/ImageUploadField";
import type { AdminNewsArticleDetail } from "@/lib/news/admin-news-queries";
import type { NewsArticleStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Slug generation helper
// ---------------------------------------------------------------------------

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  article?: AdminNewsArticleDetail;
  mode: "create" | "edit";
};

type FormState = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  imageUrl: string;
  authorName: string;
  status: NewsArticleStatus;
  publishedAt: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NewsArticleForm({ article, mode }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    title: article?.title ?? "",
    slug: article?.slug ?? "",
    excerpt: article?.excerpt ?? "",
    content: article?.content ?? "",
    imageUrl: article?.imageUrl ?? "",
    authorName: article?.authorName ?? "",
    status: article?.status ?? "DRAFT",
    publishedAt: article?.publishedAt
      ? new Date(article.publishedAt).toISOString().slice(0, 16)
      : "",
  });

  const [slugTouched, setSlugTouched] = useState(mode === "edit");

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleTitleChange(title: string) {
    setField("title", title);
    if (!slugTouched) {
      setField("slug", generateSlug(title));
    }
  }

  async function submit(targetStatus?: NewsArticleStatus) {
    setError(null);
    setSuccess(null);

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      excerpt: form.excerpt.trim() || null,
      content: form.content,
      imageUrl: form.imageUrl.trim() || null,
      authorName: form.authorName.trim() || null,
      status: targetStatus ?? form.status,
    };

    if (form.publishedAt) {
      payload.publishedAt = new Date(form.publishedAt).toISOString();
    } else if (targetStatus === "PUBLISHED") {
      payload.publishedAt = new Date().toISOString();
    } else {
      payload.publishedAt = null;
    }

    const url =
      mode === "create" ? "/api/news" : `/api/news/${article!.id}`;
    const method = mode === "create" ? "POST" : "PATCH";

    startTransition(async () => {
      try {
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Speichern fehlgeschlagen.");
          return;
        }

        if (mode === "create") {
          router.push(`/dashboard/website/news/${json.article.id}/edit?saved=1`);
        } else {
          setSuccess("Artikel gespeichert.");
          router.refresh();
        }
      } catch {
        setError("Netzwerkfehler — bitte erneut versuchen.");
      }
    });
  }

  async function handleArchive() {
    if (!article) return;
    if (!confirm("Artikel wirklich archivieren?")) return;
    await submit("ARCHIVED");
  }

  const isPublished = form.status === "PUBLISHED";
  const isArchived = form.status === "ARCHIVED";

  return (
    <div className="space-y-8">
      {/* Error / success banners */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {/* Main editor grid */}
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Left column — main content */}
        <div className="space-y-6">
          {/* Title */}
          <div className="space-y-1.5">
            <label htmlFor="title" className="fca-label">
              Titel <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={form.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Artikel-Titel"
              className="fca-input w-full text-lg font-medium"
              required
            />
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <label htmlFor="slug" className="fca-label">
              Slug <span className="text-red-500">*</span>
            </label>
            <input
              id="slug"
              type="text"
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setField("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"));
              }}
              placeholder="artikel-titel"
              className="fca-input w-full font-mono text-sm"
              required
            />
            <p className="text-xs text-zinc-400">
              URL: /news/<strong>{form.slug || "…"}</strong>
            </p>
          </div>

          {/* Excerpt */}
          <div className="space-y-1.5">
            <label htmlFor="excerpt" className="fca-label">
              Teaser / Excerpt
            </label>
            <textarea
              id="excerpt"
              value={form.excerpt}
              onChange={(e) => setField("excerpt", e.target.value)}
              rows={2}
              placeholder="Kurzbeschreibung für Übersichtsseite und SEO…"
              className="fca-input w-full resize-y"
            />
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <label htmlFor="content" className="fca-label">
              Inhalt (Markdown)
            </label>
            <p className="text-xs text-zinc-400">
              Markdown wird auf der Website gerendert. YouTube/Vimeo-Links als
              <code className="mx-1 rounded bg-zinc-100 px-1">![Beschreibung](URL)</code>
              einbetten.
            </p>
            <textarea
              id="content"
              value={form.content}
              onChange={(e) => setField("content", e.target.value)}
              rows={20}
              placeholder="## Überschrift&#10;&#10;Inhalt des Artikels…&#10;&#10;![Bild-Alt-Text](https://…)"
              className="fca-input w-full resize-y font-mono text-sm leading-relaxed"
            />
          </div>
        </div>

        {/* Right column — metadata */}
        <div className="space-y-6">
          {/* Hero image */}
          <ImageUploadField
            value={form.imageUrl}
            onChange={(url) => setField("imageUrl", url)}
          />

          {/* Author */}
          <div className="space-y-1.5">
            <label htmlFor="authorName" className="fca-label">
              Autor
            </label>
            <input
              id="authorName"
              type="text"
              value={form.authorName}
              onChange={(e) => setField("authorName", e.target.value)}
              placeholder="z.B. FC Allschwil Redaktion"
              className="fca-input w-full"
            />
          </div>

          {/* Published at */}
          <div className="space-y-1.5">
            <label htmlFor="publishedAt" className="fca-label">
              Veröffentlichungsdatum
            </label>
            <input
              id="publishedAt"
              type="datetime-local"
              value={form.publishedAt}
              onChange={(e) => setField("publishedAt", e.target.value)}
              className="fca-input w-full"
            />
            <p className="text-xs text-zinc-400">
              Leer lassen → wird beim Veröffentlichen automatisch gesetzt.
            </p>
          </div>

          {/* Status info */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
            <p className="font-medium">Status: {form.status}</p>
            {article?.createdAt && (
              <p className="mt-1 text-xs text-zinc-400">
                Erstellt: {new Date(article.createdAt).toLocaleDateString("de-CH")}
              </p>
            )}
            {article?.updatedAt && (
              <p className="text-xs text-zinc-400">
                Geändert: {new Date(article.updatedAt).toLocaleDateString("de-CH")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-6">
        {/* Save draft */}
        <button
          type="button"
          onClick={() => submit("DRAFT")}
          disabled={isPending || isArchived}
          className="fca-button-secondary flex items-center gap-2"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Entwurf speichern
        </button>

        {/* Publish / Unpublish */}
        {isPublished ? (
          <button
            type="button"
            onClick={() => submit("DRAFT")}
            disabled={isPending}
            className="fca-button-secondary flex items-center gap-2"
          >
            <EyeOff className="h-4 w-4" />
            Depublizieren
          </button>
        ) : (
          <button
            type="button"
            onClick={() => submit("PUBLISHED")}
            disabled={isPending || isArchived}
            className="fca-button-primary flex items-center gap-2"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Globe className="h-4 w-4" />
            )}
            Veröffentlichen
          </button>
        )}

        {/* Archive — only for existing articles */}
        {mode === "edit" && !isArchived && (
          <button
            type="button"
            onClick={handleArchive}
            disabled={isPending}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-60"
          >
            <Archive className="h-4 w-4" />
            Archivieren
          </button>
        )}
      </div>
    </div>
  );
}
