"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
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
import { richTextToHtml, type RichTextValue } from "@/lib/cms/rich-text";
import { Button, Card, FormSection, ValidationSummary } from "@/components/ui";
import { FormPagePattern } from "@/components/ui/patterns";

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
    article?.contentJson ?? null,
  );
  const [heroMedia, setHeroMedia] = useState<HeroMediaValue>(
    article?.heroMedia ?? null,
  );

  const [additionalMedia, setAdditionalMedia] = useState<NewsArticleMediaItem[]>(
    article?.additionalMedia ?? [],
  );

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

  const breadcrumbs = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Website" },
    { label: "News", href: "/dashboard/website/news" },
    { label: isEdit ? (article?.title ?? "Artikel bearbeiten") : "Neuer Artikel" },
  ];

  return (
    <form onSubmit={handleSave}>
      <FormPagePattern
        eyebrow="Website · News"
        title={isEdit ? (article?.title ?? "Artikel bearbeiten") : "Neuer Artikel"}
        description={
          isEdit
            ? `Slug: ${article?.slug}`
            : "Erstelle einen neuen News-Artikel. Er wird als Entwurf gespeichert bis du ihn veröffentlichst."
        }
        breadcrumbs={breadcrumbs}
        validationSummary={
          saveError ? <ValidationSummary errors={[saveError]} /> : undefined
        }
        cancelAction={
          <Button
            variant="secondary"
            type="button"
            onClick={() => router.push("/dashboard/website/news")}
          >
            Abbrechen
          </Button>
        }
        primaryAction={
          <div className="flex flex-wrap items-center gap-2">
            {isEdit && requiresReview && status === "DRAFT" && (
              <Button
                variant="secondary"
                type="button"
                loading={isPending("submit")}
                disabled={!!actionPending}
                iconLeft={<Send className="h-4 w-4" />}
                onClick={() => doAction("submit")}
              >
                Zur Prüfung einreichen
              </Button>
            )}

            {isEdit && requiresReview && status === "IN_REVIEW" && (
              <>
                <Button
                  variant="secondary"
                  type="button"
                  loading={isPending("approve")}
                  disabled={!!actionPending}
                  iconLeft={<CheckCircle className="h-4 w-4" />}
                  className="text-[var(--sce-success)]"
                  onClick={() => doAction("approve")}
                >
                  Genehmigen &amp; Veröffentlichen
                </Button>
                <Button
                  variant="danger"
                  type="button"
                  loading={isPending("reject")}
                  disabled={!!actionPending}
                  iconLeft={<XCircle className="h-4 w-4" />}
                  onClick={() => doAction("reject", { notes: reviewNotes || null })}
                >
                  Ablehnen
                </Button>
              </>
            )}

            {isEdit && !requiresReview && (
              <Button
                variant="secondary"
                type="button"
                loading={isPending("publish") || isPending("unpublish")}
                disabled={!!actionPending}
                iconLeft={
                  status === "PUBLISHED"
                    ? <EyeOff className="h-4 w-4" />
                    : <Eye className="h-4 w-4" />
                }
                onClick={() =>
                  doAction(status === "PUBLISHED" ? "unpublish" : "publish")
                }
              >
                {status === "PUBLISHED" ? "Depublizieren" : "Veröffentlichen"}
              </Button>
            )}

            {isEdit &&
              !requiresReview &&
              scheduledAtInput &&
              new Date(scheduledAtInput) > new Date() &&
              status !== "PUBLISHED" && (
                <Button
                  variant="secondary"
                  type="button"
                  loading={isPending("publish")}
                  disabled={!!actionPending}
                  iconLeft={<Clock className="h-4 w-4" />}
                  onClick={() => doAction("publish")}
                >
                  Einplanen
                </Button>
              )}

            <Button
              type="submit"
              loading={saving}
              iconLeft={<Save className="h-4 w-4" />}
            >
              {isEdit ? "Speichern" : "Entwurf erstellen"}
            </Button>
          </div>
        }
      >
        {/* Two-column layout: main content + sidebar meta */}
        <div className="grid gap-8 pt-2 lg:grid-cols-[1fr_320px]">
          {/* Left — main content */}
          <div>
            <FormSection
              title="Inhalt"
              description="Titel, Slug und Artikeltext des Beitrags."
            >
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
            </FormSection>

            <FormSection
              title="Weitere Medien"
              description="Bilder und Anhänge, die diesem Artikel zugeordnet sind."
            >
              <NewsArticleMediaGallery
                articleId={article?.id}
                items={additionalMedia}
                onItemsChange={setAdditionalMedia}
              />
            </FormSection>

            {isEdit && (status === "DRAFT" || status === "IN_REVIEW") && (
              <FormSection
                title="Prüfungsnotizen"
                description="Feedback und Anmerkungen zum Überprüfungsprozess."
              >
                {article?.reviewNotes && (
                  <div className="rounded-lg border border-[var(--sce-warning-border)] bg-[var(--sce-warning-light)] px-3 py-2.5 text-sm text-[var(--sce-warning)]">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide">
                      Feedback vom Prüfer
                    </p>
                    <p className="whitespace-pre-wrap text-xs">{article.reviewNotes}</p>
                  </div>
                )}
                {requiresReview && status === "IN_REVIEW" && (
                  <div>
                    <label className={labelClass}>Antwort / Änderungsanfrage</label>
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Feedback / Änderungsanfrage (optional)…"
                      rows={3}
                      className="fca-input resize-none text-xs"
                    />
                  </div>
                )}
              </FormSection>
            )}
          </div>

          {/* Right — sidebar meta */}
          <div className="space-y-4">
            {isEdit && (
              <Card variant="sidebar" title="Status">
                <div className="space-y-2">
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
                    <p className="text-[11px] text-[var(--sce-warning)]">
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
              </Card>
            )}

            <Card variant="sidebar" title="Geplante Veröffentlichung">
              <div className="space-y-1.5">
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
            </Card>

            <Card variant="sidebar" title="Headerbild">
              <NewsHeroMediaPicker value={heroMedia} onChange={setHeroMedia} />
            </Card>

            <Card variant="sidebar" title="Autor">
              <div className="space-y-1.5">
                <PeoplePicker
                  mode="any"
                  selected={authorPerson}
                  onSelect={(p) => setAuthorPerson(p)}
                  onClearSelected={() => setAuthorPerson(null)}
                  placeholder="Person suchen…"
                />
                <p className="text-[10px] text-[var(--muted)]">
                  Suche nach Personen aus dem System. Der Anzeigename wird gespeichert.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </FormPagePattern>
    </form>
  );
}
