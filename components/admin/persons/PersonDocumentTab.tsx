"use client";

/**
 * PERSON-UX-08 — Dokumente tab (Person-bound private document workspace).
 *
 * Person-private documents: isolated from all capacity flags and from the
 * global Dokumente module. Authorization:
 *   canViewPrivateDocuments  → tab visible; list + download only
 *   canManagePrivateDocuments → upload / edit metadata / delete
 *
 * Security:
 *   - No storage URLs/keys exposed to client.
 *   - Downloads go through /api/people/[id]/documents/[documentId]/download
 *     (server-side authorized streaming).
 *   - Tab is hidden in PersonDetailTabs when canViewPrivateDocuments=false.
 *
 * Architecture note:
 *   Person → Dokumente = private Person-bound documents (this tab).
 *   Global Dokumente (sidebar) = wider organisational workspace documents.
 *   Different authorization surfaces; document identity not shared.
 */

import { useState } from "react";
import {
  FileText,
  Upload,
  Trash2,
  Download,
  AlertCircle,
  X,
  Pencil,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/page";
import type { PersonDocumentItem } from "@/lib/people/queries";

// ── Category labels ────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  IDENTITY_DOCUMENT: "Identität",
  CONSENT:           "Einwilligung",
  CERTIFICATE:       "Bescheinigung",
  QUALIFICATION:     "Qualifikation",
  CONTRACT:          "Vertrag",
  PERMIT:            "Genehmigung",
  CORRESPONDENCE:    "Korrespondenz",
  OTHER:             "Sonstiges",
};

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function toInputDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

function isExpired(expiryDate: Date | string | null | undefined): boolean {
  if (!expiryDate) return false;
  return new Date(expiryDate) < new Date();
}

function isExpiringSoon(expiryDate: Date | string | null | undefined): boolean {
  if (!expiryDate) return false;
  const now = new Date();
  const expiry = new Date(expiryDate);
  if (expiry <= now) return false;
  const days = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return days <= 60;
}

// ── Upload form ────────────────────────────────────────────────────────────

type UploadFormProps = {
  personId: string;
  onSuccess: (doc: PersonDocumentItem) => void;
  onCancel: () => void;
};

function UploadForm({ personId, onSuccess, onCancel }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) { setError("Bitte eine Datei auswählen."); return; }
    const effectiveTitle = title.trim() || file.name;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", effectiveTitle);
      formData.append("category", category);
      if (issueDate) formData.append("issueDate", issueDate);
      if (expiryDate) formData.append("expiryDate", expiryDate);
      if (notes.trim()) formData.append("notes", notes.trim());

      const res = await fetch(`/api/people/${personId}/documents`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error ?? "Upload fehlgeschlagen.");
        return;
      }
      onSuccess(data.document as PersonDocumentItem);
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-5 space-y-4"
    >
      <h3 className="text-sm font-semibold text-[var(--foreground)]">
        Dokument hochladen
      </h3>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="fca-label block">Datei *</label>
          <input
            type="file"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
            }}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.webp,.gif,.zip"
            className="fca-input"
            required
          />
        </div>

        <div className="sm:col-span-2">
          <label className="fca-label block">Titel</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z.B. Reisepass Anna Meier"
            maxLength={200}
            className="fca-input"
          />
        </div>

        <div>
          <label className="fca-label block">Kategorie</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="fca-input"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="fca-label block">Ausstellungsdatum</label>
          <input
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            className="fca-input"
          />
        </div>

        <div>
          <label className="fca-label block">Ablaufdatum</label>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="fca-input"
          />
        </div>

        <div>
          <label className="fca-label block">Notizen</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optionale interne Notiz"
            maxLength={500}
            className="fca-input"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-1">
        <Button variant="secondary" type="button" onClick={onCancel} disabled={loading}>
          Abbrechen
        </Button>
        <Button type="submit" loading={loading}>
          <Upload className="h-4 w-4" />
          Hochladen
        </Button>
      </div>
    </form>
  );
}

// ── Edit metadata form ─────────────────────────────────────────────────────

type EditFormProps = {
  doc: PersonDocumentItem;
  personId: string;
  onSuccess: (doc: PersonDocumentItem) => void;
  onCancel: () => void;
};

function EditForm({ doc, personId, onSuccess, onCancel }: EditFormProps) {
  const [title, setTitle] = useState(doc.title);
  const [category, setCategory] = useState<string>(doc.category);
  const [issueDate, setIssueDate] = useState(toInputDate(doc.issueDate));
  const [expiryDate, setExpiryDate] = useState(toInputDate(doc.expiryDate));
  const [notes, setNotes] = useState(doc.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, string | null> = {
        title: title.trim() || doc.originalFilename,
        category,
        issueDate: issueDate || null,
        expiryDate: expiryDate || null,
        notes: notes.trim() || null,
      };

      const res = await fetch(`/api/people/${personId}/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      onSuccess(data.document as PersonDocumentItem);
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 space-y-3"
      aria-label="Metadaten bearbeiten"
    >
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="fca-label block text-xs">Titel</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className="fca-input text-sm"
          />
        </div>

        <div>
          <label className="fca-label block text-xs">Kategorie</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="fca-input text-sm"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="fca-label block text-xs">Ausstellungsdatum</label>
          <input
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            className="fca-input text-sm"
          />
        </div>

        <div>
          <label className="fca-label block text-xs">Ablaufdatum</label>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="fca-input text-sm"
          />
        </div>

        <div>
          <label className="fca-label block text-xs">Notizen</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optionale interne Notiz"
            maxLength={500}
            className="fca-input text-sm"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="secondary" size="sm" type="button" onClick={onCancel} disabled={loading}>
          <X className="h-3.5 w-3.5" />
          Abbrechen
        </Button>
        <Button size="sm" type="submit" loading={loading}>
          <Check className="h-3.5 w-3.5" />
          Speichern
        </Button>
      </div>
    </form>
  );
}

// ── Document card ──────────────────────────────────────────────────────────

type DocumentCardProps = {
  doc: PersonDocumentItem;
  personId: string;
  canManage: boolean;
  onUpdated: (doc: PersonDocumentItem) => void;
  onDeleted: (id: string) => void;
};

function DocumentCard({ doc, personId, canManage, onUpdated, onDeleted }: DocumentCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);

  const expired = isExpired(doc.expiryDate);
  const expiringSoon = !expired && isExpiringSoon(doc.expiryDate);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/people/${personId}/documents/${doc.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onDeleted(doc.id);
      }
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--muted)]">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[var(--foreground)]">
              {doc.title}
            </span>
            <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              {categoryLabel(doc.category)}
            </span>
            {expired ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                Abgelaufen
              </span>
            ) : expiringSoon ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                Läuft bald ab
              </span>
            ) : null}
          </div>

          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {doc.originalFilename} · {formatBytes(doc.sizeBytes)}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
            {doc.issueDate ? (
              <span>Ausgestellt: {formatDate(doc.issueDate)}</span>
            ) : null}
            {doc.expiryDate ? (
              <span className={expired ? "font-medium text-red-600" : expiringSoon ? "font-medium text-amber-600" : ""}>
                Gültig bis: {formatDate(doc.expiryDate)}
              </span>
            ) : null}
          </div>

          {doc.notes ? (
            <p className="mt-1 text-xs italic text-[var(--muted)]">{doc.notes}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <a
            href={`/api/people/${personId}/documents/${doc.id}/download`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)]"
            title="Herunterladen"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
          {canManage ? (
            <>
              {!editing && !confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
                  title="Metadaten bearbeiten"
                  aria-label="Bearbeiten"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              ) : null}
              {!confirmDelete && !editing ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                  title="Löschen"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : confirmDelete ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
                  >
                    {deleting ? "…" : "Löschen"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--muted)] transition hover:bg-[var(--surface-2)]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {/* Inline edit form — shown below card header */}
      {editing ? (
        <div className="border-t border-[var(--border)] px-4 pb-4">
          <EditForm
            doc={doc}
            personId={personId}
            onSuccess={(updated) => {
              setEditing(false);
              onUpdated(updated);
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : null}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

type PersonDocumentTabProps = {
  personId: string;
  initialDocuments: PersonDocumentItem[];
  canManage: boolean;
};

export default function PersonDocumentTab({
  personId,
  initialDocuments,
  canManage,
}: PersonDocumentTabProps) {
  const [documents, setDocuments] = useState<PersonDocumentItem[]>(initialDocuments);
  const [showUpload, setShowUpload] = useState(false);

  function handleUploaded(doc: PersonDocumentItem) {
    setDocuments((prev) => [doc, ...prev]);
    setShowUpload(false);
  }

  function handleUpdated(updated: PersonDocumentItem) {
    setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }

  function handleDeleted(id: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--muted)]">
            {documents.length === 0
              ? "Noch keine Dokumente hinterlegt."
              : `${documents.length} ${documents.length === 1 ? "Dokument" : "Dokumente"}`}
          </p>
        </div>
        {canManage && !showUpload && documents.length > 0 ? (
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => setShowUpload(true)}
          >
            <Upload className="h-4 w-4" />
            Dokument hinzufügen
          </Button>
        ) : null}
      </div>

      {/* Upload form */}
      {showUpload ? (
        <UploadForm
          personId={personId}
          onSuccess={handleUploaded}
          onCancel={() => setShowUpload(false)}
        />
      ) : null}

      {/* Empty state */}
      {documents.length === 0 && !showUpload ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          heading="Noch keine Dokumente"
          description="Für diese Person wurden noch keine Dokumente hinterlegt."
          action={
            canManage ? (
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setShowUpload(true)}
              >
                <Upload className="h-4 w-4" />
                Dokument hinzufügen
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              personId={personId}
              canManage={canManage}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}

      {/* Privacy notice */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
        <p className="text-[11px] text-[var(--muted)]">
          <strong>Datenschutz:</strong> Dokumente dieser Person sind vertraulich.
          Der Zugriff ist auf autorisierte Nutzer mit Dokumenten-Berechtigung beschränkt.
          Identitätsdokumente (Reisepass, Ausweis) sind besonders geschützt und
          werden nicht an Team-Rollen weitergegeben.
        </p>
      </div>
    </div>
  );
}
