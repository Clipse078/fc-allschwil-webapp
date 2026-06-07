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
} from "lucide-react";
import WebsitePageStatusBadge from "@/components/admin/pages/WebsitePageStatusBadge";
import { PeoplePicker, type PersonPickerResult } from "@/components/shared/PeoplePicker";
import type { WebsitePageAdminDetail, PageStatus } from "@/lib/pages/admin-queries";

type WebsitePageFormProps = {
  /** Existing page for edit mode. Undefined = create mode. */
  page?: WebsitePageAdminDetail;
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

export default function WebsitePageForm({
  page,
  requiresReview = false,
}: WebsitePageFormProps) {
  const router = useRouter();
  const isEdit = Boolean(page);

  const [title, setTitle] = useState(page?.title ?? "");
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [body, setBody] = useState(page?.body ?? "");
  const [seoTitle, setSeoTitle] = useState(page?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(page?.seoDescription ?? "");

  const [authorPerson, setAuthorPerson] = useState<PersonPickerResult | null>(
    page?.authorPerson
      ? {
          id: page.authorPerson.id,
          firstName: page.authorPerson.firstName,
          lastName: page.authorPerson.lastName,
          displayName: page.authorPerson.displayName,
          email: null,
          phone: null,
        }
      : null,
  );

  const [scheduledAtInput, setScheduledAtInput] = useState<string>(
    toLocalDatetimeValue(page?.scheduledAt),
  );

  const [reviewNotes, setReviewNotes] = useState(page?.reviewNotes ?? "");

  const [saving, setSaving] = useState(false);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [status, setStatus] = useState<PageStatus>(
    (page?.status as PageStatus) ?? "DRAFT",
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
    return {
      title: title.trim(),
      slug: slug.trim(),
      body,
      seoTitle: seoTitle.trim() || null,
      seoDescription: seoDescription.trim() || null,
      authorPersonId: authorPerson?.id ?? null,
      scheduledAt,
    };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setSaveError("Titel ist erforderlich."); return; }
    setSaveError(null);
    setSaving(true);
    try {
      const url = isEdit ? `/api/website-pages/${page!.id}` : "/api/website-pages";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveError(data?.error ?? "Fehler beim Speichern."); return; }

      const savedId: string = data.page?.id ?? page?.id;
      setStatus(data.page?.status as PageStatus ?? status);
      router.push(`/dashboard/website/pages/${savedId}/edit`);
      router.refresh();
    } catch {
      setSaveError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  async function doAction(action: string, extraBody?: Record<string, unknown>) {
    if (!page) return;
    setActionPending(action);
    setSaveError(null);
    try {
      const suffix = action === "publish" ? "" : `?action=${action}`;
      const res = await fetch(`/api/website-pages/${page.id}/publish${suffix}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(extraBody ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveError(data?.error ?? "Fehler beim Statuswechsel."); return; }
      setStatus(data.page?.status as PageStatus);
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
                placeholder="Seitentitel"
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
                placeholder="seiten-slug"
                className="fca-input font-mono text-xs"
              />
              <p className="mt-1 text-[10px] text-[var(--muted)]">
                Wird automatisch aus dem Titel abgeleitet. Muss pro Tenant eindeutig sein.
                Wird für die öffentliche URL verwendet.
              </p>
            </div>
            <div>
              <label className={labelClass}>Inhalt (Markdown)</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Seiteninhalt in Markdown…"
                rows={20}
                className="fca-input resize-y font-mono text-xs leading-relaxed"
              />
              <p className="mt-1 text-[10px] text-[var(--muted)]">
                Markdown wird auf der Website gerendert. Ein vollständiger Page Builder
                folgt in einem späteren Slice.
              </p>
            </div>
          </div>
        </div>

        {/* SEO section */}
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              SEO
            </p>
          </div>
          <div className="sce-detail-section-body space-y-4">
            <div>
              <label className={labelClass}>SEO-Titel</label>
              <input
                type="text"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="Optionaler SEO-Titel (überschreibt den Seitentitel im Browser-Tab)"
                className="fca-input"
              />
            </div>
            <div>
              <label className={labelClass}>Meta-Beschreibung</label>
              <textarea
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                placeholder="Kurze Beschreibung für Suchmaschinen (max. ~160 Zeichen)…"
                rows={3}
                className="fca-input resize-none"
                maxLength={320}
              />
            </div>
          </div>
        </div>

        {/* Review notes (shown when page was rejected or is in review) */}
        {isEdit && (status === "DRAFT" || status === "IN_REVIEW") && (
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Prüfungsnotizen
              </p>
            </div>
            <div className="sce-detail-section-body">
              {page?.reviewNotes && (
                <div className="mb-3 rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide">
                    Feedback vom Prüfer
                  </p>
                  <p className="whitespace-pre-wrap text-xs">{page.reviewNotes}</p>
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
              <WebsitePageStatusBadge status={status} />
              {page?.publishedAt && (
                <p className="text-[11px] text-[var(--muted)]">
                  Veröffentlicht:{" "}
                  {new Intl.DateTimeFormat("de-CH", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(page.publishedAt))}
                </p>
              )}
              {page?.scheduledAt && status === "SCHEDULED" && (
                <p className="text-[11px] text-amber-600">
                  Geplant für:{" "}
                  {new Intl.DateTimeFormat("de-CH", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(page.scheduledAt))}
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
              onChange={(e) => setScheduledAtInput(e.target.value)}
              className="fca-input text-xs"
            />
            <p className="text-[10px] text-[var(--muted)]">
              Leer lassen für sofortige Veröffentlichung. Datum in der Zukunft setzt
              Status auf &ldquo;Geplant&rdquo;.
            </p>
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
              Optional: Autor aus dem Personen-Register verknüpfen.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}
