"use client";

import { useState, useTransition } from "react";
import type { WebsiteSectionRow } from "@/lib/website/queries";
import type { WebsitePublishStatus } from "@prisma/client";
import {
  Globe,
  CheckCircle,
  Clock,
  Eye,
  EyeOff,
  FileEdit,
  ChevronDown,
  Loader2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

// ── Status meta ───────────────────────────────────────────────────────────────

const STATUS_DISPLAY: Record<
  WebsitePublishStatus,
  { label: string; badgeClass: string; dotClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  DRAFT: {
    label: "Entwurf",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
    dotClass: "bg-slate-400",
    icon: FileEdit,
  },
  IN_REVIEW: {
    label: "In Prüfung",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    dotClass: "bg-amber-400",
    icon: Clock,
  },
  APPROVED: {
    label: "Freigegeben",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    dotClass: "bg-blue-500",
    icon: CheckCircle,
  },
  PUBLISHED: {
    label: "Publiziert",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotClass: "bg-emerald-500",
    icon: Eye,
  },
  UNPUBLISHED: {
    label: "Offline",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    dotClass: "bg-rose-400",
    icon: EyeOff,
  },
};

const STATUS_TRANSITIONS: Record<WebsitePublishStatus, WebsitePublishStatus[]> = {
  DRAFT: ["IN_REVIEW", "APPROVED"],
  IN_REVIEW: ["APPROVED", "DRAFT"],
  APPROVED: ["PUBLISHED", "DRAFT"],
  PUBLISHED: ["UNPUBLISHED"],
  UNPUBLISHED: ["PUBLISHED", "DRAFT"],
};

const TRANSITION_LABELS: Record<WebsitePublishStatus, string> = {
  DRAFT: "Als Entwurf setzen",
  IN_REVIEW: "Zur Prüfung einreichen",
  APPROVED: "Freigeben",
  PUBLISHED: "Publizieren",
  UNPUBLISHED: "Offline nehmen",
};

function StatusBadge({ status }: { status: WebsitePublishStatus }) {
  const meta = STATUS_DISPLAY[status];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${meta.badgeClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

// ── Section row ───────────────────────────────────────────────────────────────

function SectionRow({
  section,
  canManage,
  onStatusChange,
  onToggleEnabled,
}: {
  section: WebsiteSectionRow;
  canManage: boolean;
  onStatusChange: (sectionId: string, newStatus: WebsitePublishStatus) => Promise<void>;
  onToggleEnabled: (sectionId: string, isEnabled: boolean) => Promise<void>;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const transitions = STATUS_TRANSITIONS[section.status] ?? [];

  function handleStatusChange(newStatus: WebsitePublishStatus) {
    setDropdownOpen(false);
    startTransition(async () => {
      await onStatusChange(section.id, newStatus);
    });
  }

  function handleToggleEnabled() {
    startTransition(async () => {
      await onToggleEnabled(section.id, !section.isEnabled);
    });
  }

  return (
    <div className="flex items-center gap-4 border-b border-[var(--border)] py-4 last:border-0 last:pb-0">
      {/* Icon + label */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Globe className="h-4 w-4 shrink-0 text-[var(--muted)]" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--foreground)]">
            {section.label ?? section.sectionType}
          </p>
          {section.lastPublishedAt && (
            <p className="text-[11px] text-[var(--muted)]">
              Publiziert: {new Date(section.lastPublishedAt).toLocaleDateString("de-CH")}
            </p>
          )}
        </div>
      </div>

      {/* Status badge */}
      <StatusBadge status={section.status} />

      {canManage && (
        <div className="flex items-center gap-2 shrink-0">
          {/* Toggle enabled */}
          <button
            type="button"
            onClick={handleToggleEnabled}
            disabled={pending}
            title={section.isEnabled ? "Sektion deaktivieren" : "Sektion aktivieren"}
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)] disabled:opacity-50"
          >
            {section.isEnabled ? (
              <ToggleRight className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <ToggleLeft className="h-3.5 w-3.5 text-[var(--muted)]" />
            )}
            {section.isEnabled ? "Aktiv" : "Inaktiv"}
          </button>

          {/* Status transition dropdown */}
          {transitions.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen((v) => !v)}
                disabled={pending}
                className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)] disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                Status ändern
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg">
                  {transitions.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleStatusChange(t)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-[var(--foreground)] hover:bg-[var(--surface-2)]"
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DISPLAY[t].dotClass}`} />
                      {TRANSITION_LABELS[t]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

type Props = {
  initialSections: WebsiteSectionRow[];
  canManage: boolean;
};

export default function WebsiteSectionsPanel({
  initialSections,
  canManage,
}: Props) {
  const [sections, setSections] = useState(initialSections);
  const [error, setError] = useState<string | null>(null);

  async function handleStatusChange(sectionId: string, newStatus: WebsitePublishStatus) {
    setError(null);
    try {
      const res = await fetch(`/api/website/sections/${sectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Status konnte nicht geändert werden.");
        return;
      }
      setSections((prev) =>
        prev.map((s) => (s.id === sectionId ? { ...s, status: newStatus, ...(newStatus === "PUBLISHED" ? { lastPublishedAt: new Date() } : {}) } : s)),
      );
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    }
  }

  async function handleToggleEnabled(sectionId: string, isEnabled: boolean) {
    setError(null);
    try {
      const res = await fetch(`/api/website/sections/${sectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Sektion konnte nicht aktualisiert werden.");
        return;
      }
      setSections((prev) =>
        prev.map((s) => (s.id === sectionId ? { ...s, isEnabled } : s)),
      );
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            Sektionen ({sections.length})
          </span>
        </div>
        <div className="sce-detail-section-body">
          {sections.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Keine Sektionen vorhanden.</p>
          ) : (
            <div>
              {sections.map((section) => (
                <SectionRow
                  key={section.id}
                  section={section}
                  canManage={canManage}
                  onStatusChange={handleStatusChange}
                  onToggleEnabled={handleToggleEnabled}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {!canManage && (
        <p className="text-[12px] text-[var(--muted)]">
          Du hast nur Lesezugriff auf die Website-Sektionen.
        </p>
      )}
    </div>
  );
}
