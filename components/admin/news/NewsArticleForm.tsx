"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Eye, EyeOff, Archive, Upload, X, ExternalLink } from "lucide-react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import type { AdminNewsArticleDetail } from "@/lib/news/admin-queries";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  article?: AdminNewsArticleDetail;
};

// ---------------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100);
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function statusLabel(status: string): string {
  if (status === "PUBLISHED") return "Veröffentlicht";
  if (status === "ARCHIVED") return "Archiviert";
  return "Entwurf";
}

function statusTone(
  status: string,
): "default" | "success" | "muted" | "warning" {
  if (status === "PUBLISHED") return "success";
  if (status === "ARCHIVED") return "muted";
  return "default";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NewsArticleForm({ mode, article }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(article?.title ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? "");
  const [content, setContent] = useState(article?.content ?? "");
  const [imageUrl, setImageUrl] = useState(article?.imageUrl ?? "");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(
    mode === "edit" && !!article?.slug,
  );

  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const currentStatus = article?.status ?? "DRAFT";
  const isPublished = currentStatus === "PUBLISHED";
  const isArchived = currentStatus === "ARCHIVED";

  // Auto-derive slug from title unless manually edited
  const handleTitleChange = useCallback(
    (value: string) => {
      setTitle(value);
      if (!slugManuallyEdited) {
        setSlug(slugify(value));
      }
    },
    [slugManuallyEdited],
  );

  const handleSlugChange = useCallback((value: string) => {
    setSlug(value);
    setSlugManuallyEdited(true);
  }, []);

  // ---------------------------------------------------------------------------
  // Save / create
  // ---------------------------------------------------------------------------

  async function handleSave() {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        slug: slugify(slug || slugify(title)),
        excerpt: excerpt.trim() || null,
        content,
        imageUrl: imageUrl.trim() || null,
      };

      let res: Response;
      if (mode === "create") {
        res = await fetch("/api/news", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/news/${article!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Fehler beim Speichern.");
        return;
      }

      setSaved(true);

      if (mode === "create" && data.article?.id) {
        router.push(`/dashboard/website/news/${data.article.id}?saved=1`);
      } else {
        router.refresh();
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setError("Netzwerkfehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Publish / unpublish / archive
  // ---------------------------------------------------------------------------

  async function handlePublish() {
    if (mode === "create") {
      await handleSave();
      return;
    }
    setError(null);
    setPublishing(true);
    try {
      const res = await fetch(`/api/news/${article!.id}/publish`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Fehler beim Veröffentlichen.");
        return;
      }
      router.refresh();
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleUnpublish() {
    setError(null);
    setUnpublishing(true);
    try {
      const res = await fetch(`/api/news/${article!.id}/unpublish`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Fehler beim Depublizieren.");
        return;
      }
      router.refresh();
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setUnpublishing(false);
    }
  }

  async function handleArchive() {
    if (
      !confirm(
        "Artikel archivieren? Er wird aus dem öffentlichen Feed entfernt.",
      )
    )
      return;
    setError(null);
    setArchiving(true);
    try {
      const res = await fetch(`/api/news/${article!.id}/archive`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Fehler beim Archivieren.");
        return;
      }
      router.push("/dashboard/website/news?archived=1");
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setArchiving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Hero image upload
  // ---------------------------------------------------------------------------

  async function handleImageUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (article?.id) fd.append("articleId", article.id);

      const res = await fetch("/api/news/hero-image", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Fehler beim Hochladen.");
        return;
      }
      setImageUrl(data.imageUrl ?? "");
    } catch {
      setError("Netzwerkfehler beim Hochladen.");
    } finally {
      setUploading(false);
    }
  }

  const busy = saving || publishing || unpublishing || archiving || uploading;

  // ---------------------------------------------------------------------------
  // Markdown preview (minimal safe renderer — no dangerouslySetInnerHTML)
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/website/news"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-2)] hover:text-[var(--foreground)] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Zurück zur Übersicht
      </Link>

      {/* Status + action bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AdminStatusPill
            label={statusLabel(currentStatus)}
            tone={statusTone(currentStatus)}
          />
          {article?.publishedAt && (
            <span className="text-xs text-[var(--text-2)]">
              Veröffentlicht am{" "}
              {new Intl.DateTimeFormat("de-CH", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              }).format(new Date(article.publishedAt))}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isPublished && (
            <a
              href={`/api/public/v1/website/news/${article!.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Vorschau
            </a>
          )}

          {!isArchived && (
            <button
              type="button"
              disabled={busy}
              onClick={handleSave}
              className="fca-button-secondary flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? "Speichern…" : "Speichern"}
            </button>
          )}

          {!isPublished && !isArchived && (
            <button
              type="button"
              disabled={busy}
              onClick={handlePublish}
              className="fca-button-primary flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              {publishing ? "Veröffentlichen…" : "Veröffentlichen"}
            </button>
          )}

          {isPublished && (
            <button
              type="button"
              disabled={busy}
              onClick={handleUnpublish}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
            >
              <EyeOff className="h-4 w-4" />
              {unpublishing ? "Depublizieren…" : "Depublizieren"}
            </button>
          )}

          {mode === "edit" && !isArchived && (
            <button
              type="button"
              disabled={busy}
              onClick={handleArchive}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
            >
              <Archive className="h-4 w-4" />
              {archiving ? "Archivieren…" : "Archivieren"}
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <X className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Saved confirmation */}
      {saved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Gespeichert.
        </div>
      )}

      {/* Main form */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Content column */}
        <div className="space-y-5 lg:col-span-2">
          {/* Title */}
          <AdminSurfaceCard>
            <div className="space-y-4 p-5">
              <div className="space-y-1.5">
                <label className="fca-label" htmlFor="news-title">
                  Titel <span className="text-red-500">*</span>
                </label>
                <input
                  id="news-title"
                  type="text"
                  className="fca-input"
                  placeholder="Artikeltitel"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  disabled={isArchived}
                  autoFocus={mode === "create"}
                />
              </div>

              <div className="space-y-1.5">
                <label className="fca-label" htmlFor="news-slug">
                  Slug
                </label>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-sm text-[var(--text-2)]">/news/</span>
                  <input
                    id="news-slug"
                    type="text"
                    className="fca-input font-mono text-sm"
                    placeholder="artikel-slug"
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    disabled={isArchived}
                  />
                </div>
                <p className="text-xs text-[var(--muted)]">
                  Wird automatisch aus dem Titel generiert. Muss eindeutig sein.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="fca-label" htmlFor="news-excerpt">
                  Kurzbeschreibung
                </label>
                <textarea
                  id="news-excerpt"
                  className="fca-textarea min-h-[72px] resize-y"
                  placeholder="Optionale Zusammenfassung für Listen und Social-Media-Vorschau…"
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  disabled={isArchived}
                />
              </div>
            </div>
          </AdminSurfaceCard>

          {/* Content / Markdown editor */}
          <AdminSurfaceCard>
            <div className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <label className="fca-label">
                  Inhalt (Markdown)
                </label>
                <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab("write")}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      activeTab === "write"
                        ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                        : "text-[var(--text-2)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    Schreiben
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("preview")}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      activeTab === "preview"
                        ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                        : "text-[var(--text-2)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    Vorschau
                  </button>
                </div>
              </div>

              {activeTab === "write" ? (
                <textarea
                  className="fca-textarea min-h-[400px] resize-y font-mono text-sm"
                  placeholder={`# Überschrift\n\nEin Absatz mit **fettem** und *kursivem* Text.\n\n## Unterabschnitt\n\nEin [Link](https://example.com).\n\n![Bildbeschreibung](https://example.com/bild.jpg)\n\n> Blockzitat`}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  disabled={isArchived}
                />
              ) : (
                <MarkdownPreview content={content} />
              )}

              <p className="mt-2 text-xs text-[var(--muted)]">
                Markdown-Syntax: **fett**, *kursiv*, [Link](URL), ![Bild](URL),
                # Überschrift, &gt; Blockzitat. YouTube/Vimeo-Embeds via
                iframe sind aus Sicherheitsgründen nicht unterstützt — verwende Links stattdessen.
              </p>
            </div>
          </AdminSurfaceCard>
        </div>

        {/* Sidebar column */}
        <div className="space-y-5">
          {/* Hero image */}
          <AdminSurfaceCard>
            <div className="space-y-4 p-5">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                Titelbild
              </h3>

              {imageUrl && (
                <div className="relative overflow-hidden rounded-xl border border-[var(--border)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Hero-Vorschau"
                    className="h-40 w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-slate-600 shadow-sm hover:bg-white"
                    title="Titelbild entfernen"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <button
                  type="button"
                  disabled={isArchived || uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="fca-button-secondary flex w-full items-center justify-center gap-2 text-sm"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? "Hochladen…" : "Bild hochladen"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                    e.target.value = "";
                  }}
                />

                <div className="space-y-1">
                  <label className="fca-label text-xs" htmlFor="news-image-url">
                    Oder URL manuell eingeben
                  </label>
                  <input
                    id="news-image-url"
                    type="url"
                    className="fca-input text-sm"
                    placeholder="https://example.com/bild.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    disabled={isArchived}
                  />
                </div>
              </div>

              <p className="text-xs text-[var(--muted)]">
                PNG, JPEG oder WebP. Max. 2 MB. Empfohlen: 1200 × 630 px.
              </p>
            </div>
          </AdminSurfaceCard>

          {/* Info / metadata */}
          {mode === "edit" && article && (
            <AdminSurfaceCard>
              <div className="space-y-3 p-5">
                <h3 className="text-sm font-semibold text-[var(--foreground)]">
                  Metadaten
                </h3>
                <div className="space-y-2 text-xs text-[var(--text-2)]">
                  <div className="flex justify-between gap-2">
                    <span>ID</span>
                    <code className="max-w-[140px] truncate rounded bg-[var(--surface-2)] px-1.5 py-0.5">
                      {article.id}
                    </code>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Erstellt</span>
                    <span>
                      {new Intl.DateTimeFormat("de-CH").format(
                        new Date(article.createdAt),
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Geändert</span>
                    <span>
                      {new Intl.DateTimeFormat("de-CH").format(
                        new Date(article.updatedAt),
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </AdminSurfaceCard>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Minimal safe Markdown preview
// ---------------------------------------------------------------------------

function MarkdownPreview({ content }: { content: string }) {
  if (!content.trim()) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--muted)]">
        Kein Inhalt zum Anzeigen.
      </div>
    );
  }

  // Very simple line-by-line markdown rendering without dangerouslySetInnerHTML.
  // Supports: headings, bold, italic, links, images, blockquotes, horizontal rules,
  // unordered lists, code blocks.
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre
          key={i}
          className="overflow-x-auto rounded-xl bg-[var(--surface-2)] p-4 text-xs font-mono text-[var(--foreground)]"
        >
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} className="border-[var(--border)]" />);
      i++;
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.+)/);
    if (h) {
      const level = h[1].length;
      const text = h[2];
      const cls = [
        "font-bold text-[var(--foreground)]",
        level === 1 ? "text-2xl mt-6 mb-3" : "",
        level === 2 ? "text-xl mt-5 mb-2" : "",
        level >= 3 ? "text-base mt-4 mb-1.5" : "",
      ]
        .filter(Boolean)
        .join(" ");
      elements.push(
        <div key={i} className={cls}>
          {renderInline(text)}
        </div>,
      );
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={i}
          className="border-l-4 border-[var(--tenant-primary)] pl-4 text-[var(--text-2)] italic"
        >
          {renderInline(line.slice(2))}
        </blockquote>,
      );
      i++;
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={i} className="list-disc pl-5 space-y-1">
          {items.map((item, idx) => (
            <li key={idx} className="text-sm text-[var(--foreground)]">
              {renderInline(item)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      elements.push(
        <ol key={i} className="list-decimal pl-5 space-y-1">
          {items.map((item, idx) => (
            <li key={idx} className="text-sm text-[var(--foreground)]">
              {renderInline(item)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={i} className="h-3" />);
      i++;
      continue;
    }

    // Paragraph
    elements.push(
      <p key={i} className="text-sm leading-relaxed text-[var(--foreground)]">
        {renderInline(line)}
      </p>,
    );
    i++;
  }

  return (
    <div className="min-h-[400px] space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-5">
      {elements}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  // Process inline markdown: images, links, bold, italic, inline code
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Image: ![alt](url)
    const imgMatch = remaining.match(/^([\s\S]*?)!\[([^\]]*)\]\(([^)]+)\)([\s\S]*)/);
    if (imgMatch) {
      if (imgMatch[1]) parts.push(<span key={key++}>{renderInline(imgMatch[1])}</span>);
      parts.push(
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={key++}
          src={imgMatch[3]}
          alt={imgMatch[2]}
          className="max-w-full rounded-lg"
        />,
      );
      remaining = imgMatch[4];
      continue;
    }

    // Link: [text](url)
    const linkMatch = remaining.match(/^([\s\S]*?)\[([^\]]+)\]\(([^)]+)\)([\s\S]*)/);
    if (linkMatch) {
      if (linkMatch[1]) parts.push(<span key={key++}>{renderInline(linkMatch[1])}</span>);
      parts.push(
        <a
          key={key++}
          href={linkMatch[3]}
          target="_blank"
          rel="noreferrer noopener"
          className="underline text-[var(--tenant-primary)] hover:opacity-80"
        >
          {linkMatch[2]}
        </a>,
      );
      remaining = linkMatch[4];
      continue;
    }

    // Bold: **text** or __text__
    const boldMatch = remaining.match(/^([\s\S]*?)(\*\*|__)(.+?)\2([\s\S]*)/);
    if (boldMatch) {
      if (boldMatch[1]) parts.push(<span key={key++}>{renderInline(boldMatch[1])}</span>);
      parts.push(<strong key={key++}>{boldMatch[3]}</strong>);
      remaining = boldMatch[4];
      continue;
    }

    // Italic: *text* or _text_
    const italicMatch = remaining.match(/^([\s\S]*?)(\*|_)(.+?)\2([\s\S]*)/);
    if (italicMatch) {
      if (italicMatch[1]) parts.push(<span key={key++}>{renderInline(italicMatch[1])}</span>);
      parts.push(<em key={key++}>{italicMatch[3]}</em>);
      remaining = italicMatch[4];
      continue;
    }

    // Inline code: `code`
    const codeMatch = remaining.match(/^([\s\S]*?)`([^`]+)`([\s\S]*)/);
    if (codeMatch) {
      if (codeMatch[1]) parts.push(<span key={key++}>{renderInline(codeMatch[1])}</span>);
      parts.push(
        <code
          key={key++}
          className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-xs"
        >
          {codeMatch[2]}
        </code>,
      );
      remaining = codeMatch[3];
      continue;
    }

    // Plain text — consume rest
    parts.push(<span key={key++}>{remaining}</span>);
    break;
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}
