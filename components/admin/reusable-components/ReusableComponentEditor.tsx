"use client";

/**
 * ReusableComponentEditor
 *
 * Generic editor for all reusable component types (CMS V2 Slice 12).
 * Supports create and edit modes.
 *
 * Features:
 * - Type selector (create mode only)
 * - Title / slug / description
 * - Type-specific config form
 * - Publish / unpublish actions
 * - Approval workflow actions
 * - Version history panel
 * - Usage tracking panel
 * - Autosave indicator
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  Globe,
  EyeOff,
  ArrowLeft,
  History,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  MousePointerClick,
  Award,
  ContactRound,
  CircleHelp,
  Quote,
  BarChart3,
  Megaphone,
  FileText,
} from "lucide-react";
import type { ReusableComponentAdminItem } from "@/lib/reusable-components/types";
import {
  REUSABLE_COMPONENT_TYPES,
  COMPONENT_TYPE_LABELS,
  getDefaultConfig,
} from "@/lib/reusable-components/component-types";
import type { ReusableComponentType } from "@/lib/reusable-components/component-types";
import { SECTION_PUBLISH_STATUS } from "@/lib/cms/section-publishing";
import CtaConfigForm from "./config-forms/CtaConfigForm";
import SponsorBannerConfigForm from "./config-forms/SponsorBannerConfigForm";
import ContactCardConfigForm from "./config-forms/ContactCardConfigForm";
import FaqConfigForm from "./config-forms/FaqConfigForm";
import QuoteConfigForm from "./config-forms/QuoteConfigForm";
import StatisticsConfigForm from "./config-forms/StatisticsConfigForm";
import AnnouncementConfigForm from "./config-forms/AnnouncementConfigForm";
import RichTextConfigForm from "./config-forms/RichTextConfigForm";
// V4.2 Component Library additions
import HeroConfigForm from "./config-forms/HeroConfigForm";
import TimelineConfigForm from "./config-forms/TimelineConfigForm";
import TeamGridConfigForm from "./config-forms/TeamGridConfigForm";
import RegistrationCtaConfigForm from "./config-forms/RegistrationCtaConfigForm";
import FooterBlockConfigForm from "./config-forms/FooterBlockConfigForm";

// ── Type icon map ─────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, React.ReactNode> = {
  CTA:              <MousePointerClick className="h-5 w-5" />,
  SPONSOR_BANNER:   <Award className="h-5 w-5" />,
  CONTACT_CARD:     <ContactRound className="h-5 w-5" />,
  FAQ:              <CircleHelp className="h-5 w-5" />,
  QUOTE:            <Quote className="h-5 w-5" />,
  STATISTICS:       <BarChart3 className="h-5 w-5" />,
  ANNOUNCEMENT:     <Megaphone className="h-5 w-5" />,
  RICH_TEXT:        <FileText className="h-5 w-5" />,
  HERO:             <FileText className="h-5 w-5" />,
  TIMELINE:         <FileText className="h-5 w-5" />,
  TEAM_GRID:        <FileText className="h-5 w-5" />,
  REGISTRATION_CTA: <MousePointerClick className="h-5 w-5" />,
  FOOTER_BLOCK:     <FileText className="h-5 w-5" />,
};

// ── Config form dispatcher ────────────────────────────────────────────────────

function ConfigForm({
  type,
  config,
  onChange,
}: {
  type: string;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  switch (type) {
    case "CTA":            return <CtaConfigForm config={config} onChange={onChange} />;
    case "SPONSOR_BANNER": return <SponsorBannerConfigForm config={config} onChange={onChange} />;
    case "CONTACT_CARD":   return <ContactCardConfigForm config={config} onChange={onChange} />;
    case "FAQ":            return <FaqConfigForm config={config} onChange={onChange} />;
    case "QUOTE":          return <QuoteConfigForm config={config} onChange={onChange} />;
    case "STATISTICS":     return <StatisticsConfigForm config={config} onChange={onChange} />;
    case "ANNOUNCEMENT":   return <AnnouncementConfigForm config={config} onChange={onChange} />;
    case "RICH_TEXT":      return <RichTextConfigForm config={config} onChange={onChange} />;
    // V4.2 additions
    case "HERO":             return <HeroConfigForm config={config} onChange={onChange} />;
    case "TIMELINE":         return <TimelineConfigForm config={config} onChange={onChange} />;
    case "TEAM_GRID":        return <TeamGridConfigForm config={config} onChange={onChange} />;
    case "REGISTRATION_CTA": return <RegistrationCtaConfigForm config={config} onChange={onChange} />;
    case "FOOTER_BLOCK":     return <FooterBlockConfigForm config={config} onChange={onChange} />;
    default: return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        Kein Formular für Typ «{type}» verfügbar.
      </div>
    );
  }
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusChip({ publishStatus }: { publishStatus: string }) {
  if (publishStatus === SECTION_PUBLISH_STATUS.PUBLISHED) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        <CheckCircle2 className="h-3 w-3" />
        Veröffentlicht
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
      <Clock className="h-3 w-3" />
      Entwurf
    </span>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────

type EditorMode = "create" | "edit";

type ReusableComponentEditorProps = {
  mode: EditorMode;
  initialData?: ReusableComponentAdminItem;
};

export default function ReusableComponentEditor({
  mode,
  initialData,
}: ReusableComponentEditorProps) {
  const router = useRouter();

  // Form state
  const [selectedType, setSelectedType] = useState<string>(initialData?.type ?? "");
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [config, setConfig] = useState<Record<string, unknown>>(
    initialData?.config ?? {},
  );
  const [slugEdited, setSlugEdited] = useState(false);

  // UI state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [component, setComponent] = useState<ReusableComponentAdminItem | null>(
    initialData ?? null,
  );
  const [activeTab, setActiveTab] = useState<"config" | "history" | "usage">("config");
  const [usages, setUsages] = useState<Array<{ id: string; label: string; href?: string; entityType: string }>>([]);
  const [revisions, setRevisions] = useState<Array<{ id: string; versionNumber: number; changeNote: string | null; createdAt: Date; createdByUser?: { firstName: string; lastName: string } | null }>>([]);

  // Auto-generate slug from title (only if not manually edited and in create mode)
  useEffect(() => {
    if (mode === "create" && !slugEdited && title) {
      const auto = title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
      setSlug(auto);
    }
  }, [title, mode, slugEdited]);

  // Initialize config when type is selected (create mode)
  useEffect(() => {
    if (mode === "create" && selectedType) {
      setConfig(getDefaultConfig(selectedType as ReusableComponentType));
    }
  }, [selectedType, mode]);

  // Load usage and revisions for edit mode
  useEffect(() => {
    if (mode === "edit" && initialData) {
      loadUsage(initialData.id);
      loadRevisions(initialData.id);
    }
  }, [mode, initialData]);

  async function loadUsage(id: string) {
    try {
      const res = await fetch(`/api/reusable-components/${id}/usage`);
      if (res.ok) {
        const data = await res.json();
        setUsages(data.usages ?? []);
      }
    } catch { /* best-effort */ }
  }

  async function loadRevisions(id: string) {
    try {
      const res = await fetch(`/api/reusable-components/${id}/revisions`);
      if (res.ok) {
        const data = await res.json();
        setRevisions(data.revisions ?? []);
      }
    } catch { /* best-effort */ }
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      if (mode === "create") {
        if (!selectedType) {
          setSaveError("Bitte einen Komponenten-Typ auswählen.");
          return;
        }
        if (!title.trim()) {
          setSaveError("Titel ist erforderlich.");
          return;
        }
        const res = await fetch("/api/reusable-components", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: selectedType, title, slug: slug || undefined, description: description || undefined, config }),
        });
        if (!res.ok) {
          const data = await res.json();
          setSaveError(data.error ?? "Fehler beim Erstellen.");
          return;
        }
        const data = await res.json();
        setSaveSuccess(true);
        router.push(`/dashboard/website/components/${data.component.id}/edit`);
      } else {
        if (!component) return;
        const res = await fetch(`/api/reusable-components/${component.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, slug: slug || undefined, description: description || undefined, config }),
        });
        if (!res.ok) {
          const data = await res.json();
          setSaveError(data.error ?? "Fehler beim Speichern.");
          return;
        }
        const data = await res.json();
        setComponent(data.component);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        loadRevisions(component.id);
      }
    } finally {
      setSaving(false);
    }
  }, [mode, selectedType, title, slug, description, config, component, router]);

  // ── Publish / Unpublish ───────────────────────────────────────────────────

  async function handlePublish() {
    if (!component) return;
    setPublishing(true);
    const res = await fetch(`/api/reusable-components/${component.id}/publish`, {
      method: "PATCH",
    });
    if (res.ok) {
      const data = await res.json();
      setComponent(data.component);
    }
    setPublishing(false);
  }

  async function handleUnpublish() {
    if (!component) return;
    setPublishing(true);
    const res = await fetch(`/api/reusable-components/${component.id}/unpublish`, {
      method: "PATCH",
    });
    if (res.ok) {
      const data = await res.json();
      setComponent(data.component);
    }
    setPublishing(false);
  }

  // ── Restore revision ──────────────────────────────────────────────────────

  async function handleRestore(revId: string) {
    if (!component) return;
    if (!confirm("Diese Version wiederherstellen? Der aktuelle Stand wird als neue Revision gespeichert.")) return;
    const res = await fetch(
      `/api/reusable-components/${component.id}/revisions/${revId}/restore`,
      { method: "POST" },
    );
    if (res.ok) {
      const data = await res.json();
      setComponent(data.component);
      setTitle(data.component.title);
      setDescription(data.component.description ?? "");
      setConfig(data.component.config);
      loadRevisions(component.id);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const currentStatus = component?.publishStatus ?? SECTION_PUBLISH_STATUS.DRAFT;
  const isPublished = currentStatus === SECTION_PUBLISH_STATUS.PUBLISHED;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <a
          href="/dashboard/website/components"
          className="flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Bibliothek
        </a>
        {component && (
          <>
            <span className="text-[var(--muted)]">/</span>
            <span className="text-sm text-[var(--foreground)]">{component.title}</span>
          </>
        )}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {(selectedType || component?.type) && (
            <span
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ background: "var(--tenant-accent)", color: "var(--tenant-primary)" }}
            >
              {TYPE_ICONS[selectedType || component?.type || ""] ?? <FileText className="h-5 w-5" />}
            </span>
          )}
          <div>
            <h1 className="text-xl font-bold text-[var(--foreground)]">
              {mode === "create" ? "Neue Komponente" : (component?.title ?? "Komponente bearbeiten")}
            </h1>
            {component && (
              <p className="text-sm text-[var(--muted)]">
                {COMPONENT_TYPE_LABELS[component.type] ?? component.type} · /{component.slug}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {component && <StatusChip publishStatus={component.publishStatus} />}

          {component && (
            isPublished ? (
              <button
                onClick={handleUnpublish}
                disabled={publishing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)] disabled:opacity-50"
              >
                {publishing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />}
                Zurückziehen
              </button>
            ) : (
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "var(--tenant-primary)" }}
              >
                {publishing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
                Veröffentlichen
              </button>
            )
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            style={{ background: saving ? "var(--muted)" : "var(--tenant-primary)" }}
          >
            {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </div>

      {/* Save feedback */}
      {saveError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {saveError}
        </div>
      )}
      {saveSuccess && mode === "edit" && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          Gespeichert.
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left: form */}
        <div className="lg:col-span-2 space-y-5">
          {/* Type selector (create mode) */}
          {mode === "create" && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">Komponenten-Typ</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {REUSABLE_COMPONENT_TYPES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setSelectedType(t.key)}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-medium transition-colors ${
                      selectedType === t.key
                        ? "border-[var(--tenant-primary)] text-[var(--tenant-primary)]"
                        : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--tenant-primary)] hover:text-[var(--foreground)]"
                    }`}
                    style={selectedType === t.key ? { background: "var(--tenant-accent)" } : {}}
                  >
                    <span className="text-lg">{TYPE_ICONS[t.key]}</span>
                    <span className="text-center leading-tight">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Allgemein</h2>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--foreground)]">
                Titel <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z.B. «Mitglied werden CTA»"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--tenant-primary)]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--foreground)]">
                Slug
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => { setSlug(e.target.value); setSlugEdited(true); }}
                placeholder="z.B. mitglied-werden-cta"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-mono text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--tenant-primary)]"
              />
              <p className="mt-1 text-xs text-[var(--muted)]">Eindeutiger Bezeichner für die API-Referenzierung.</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--foreground)]">
                Beschreibung
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Kurze Beschreibung — erscheint im Picker."
                className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--tenant-primary)]"
              />
            </div>
          </div>

          {/* Config form */}
          {(selectedType || (mode === "edit" && component)) && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">
                {COMPONENT_TYPE_LABELS[selectedType || component?.type || ""] ?? "Inhalt"}
              </h2>
              <ConfigForm
                type={selectedType || component?.type || ""}
                config={config}
                onChange={setConfig}
              />
            </div>
          )}
        </div>

        {/* Right: tabs panel */}
        {mode === "edit" && component && (
          <div className="space-y-4">
            {/* Tab buttons */}
            <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 gap-1">
              {(["config", "history", "usage"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                    activeTab === tab
                      ? "bg-[var(--tenant-primary)] text-white"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {tab === "config" ? "Info" : tab === "history" ? "Verlauf" : "Verwendungen"}
                </button>
              ))}
            </div>

            {activeTab === "config" && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-[var(--muted)]" />
                  <span className="text-[var(--muted)]">Erstellt:</span>
                  <span className="text-[var(--foreground)]">
                    {new Date(component.createdAt).toLocaleDateString("de-CH")}
                  </span>
                </div>
                {component.createdByUser && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-[var(--muted)]" />
                    <span className="text-[var(--muted)]">Von:</span>
                    <span className="text-[var(--foreground)]">
                      {component.createdByUser.firstName} {component.createdByUser.lastName}
                    </span>
                  </div>
                )}
                {component.publishedAt && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-[var(--muted)]" />
                    <span className="text-[var(--muted)]">Veröffentlicht:</span>
                    <span className="text-[var(--foreground)]">
                      {new Date(component.publishedAt).toLocaleDateString("de-CH")}
                    </span>
                  </div>
                )}
              </div>
            )}

            {activeTab === "history" && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2">
                <p className="text-xs font-semibold text-[var(--foreground)] mb-3">Versionshistorie</p>
                {revisions.length === 0 ? (
                  <p className="text-xs text-[var(--muted)]">Noch keine Versionen.</p>
                ) : (
                  <ul className="space-y-2">
                    {revisions.map((rev) => (
                      <li key={rev.id} className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[var(--foreground)]">
                            Version {rev.versionNumber}
                            {rev.changeNote && ` — ${rev.changeNote}`}
                          </p>
                          <p className="text-xs text-[var(--muted)]">
                            {new Date(rev.createdAt).toLocaleDateString("de-CH")}
                            {rev.createdByUser && ` · ${rev.createdByUser.firstName} ${rev.createdByUser.lastName}`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRestore(rev.id)}
                          className="text-xs text-[var(--tenant-primary)] hover:underline flex-shrink-0"
                        >
                          Wiederherstellen
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {activeTab === "usage" && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2">
                <p className="text-xs font-semibold text-[var(--foreground)] mb-3">
                  Verwendungen ({usages.length})
                </p>
                {usages.length === 0 ? (
                  <p className="text-xs text-[var(--muted)]">
                    Noch nirgends verwendet. Referenziere diese Komponente in einer Seite oder einem Modul.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {usages.map((u) => (
                      <li key={u.id} className="text-xs">
                        {u.href ? (
                          <a
                            href={u.href}
                            className="text-[var(--tenant-primary)] hover:underline"
                          >
                            {u.label}
                          </a>
                        ) : (
                          <span className="text-[var(--foreground)]">{u.label}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
