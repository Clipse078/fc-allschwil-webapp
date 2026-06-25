/**
 * Website Management — overview page.
 *
 * /dashboard/website
 *
 * Provides a unified entry point for all website-related operations:
 * status, configuration, publishing controls, public API overview,
 * and content area links.
 *
 * Permission: WEBSITE_MANAGE (or NEWS_MANAGE for read access to content areas)
 * Tenant isolation: all data resolved from session.user.tenantId
 *
 * TODO(permission): Add a dedicated WEBSITE_MANAGE permission gate once the
 * permission seeding covers WEBSITE_MANAGE for all admin roles. For now,
 * WEBSITE_MANAGE is the primary guard with NEWS_MANAGE as a fallback for
 * users who manage content but not settings.
 */

import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Image as ImageIcon,
  Layers,
  Newspaper,
  Settings2,
  Shield,
  Sparkles,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantContextFromSession } from "@/lib/tenants/context";
import { notFound } from "next/navigation";
import {
  PageShell,
  PageBreadcrumbs,
  PageHeader,
  SectionCard,
} from "@/components/ui/page";

// ── Helpers ────────────────────────────────────────────────────────────────────

function publishModeBadge(mode: "DRAFT" | "STAGED" | "LIVE") {
  if (mode === "LIVE") return { label: "Live", colorClass: "bg-emerald-100 text-emerald-700" };
  if (mode === "STAGED") return { label: "Staged", colorClass: "bg-amber-100 text-amber-700" };
  return { label: "Entwurf", colorClass: "bg-[var(--surface-3)] text-[var(--muted)]" };
}

function formatDateTime(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

// ── Public API routes catalogue ────────────────────────────────────────────────

const PUBLIC_API_ROUTES = [
  {
    path: "/api/public/v1/website/news",
    label: "News-Feed",
    description: "Veröffentlichte News-Artikel",
    tenantFiltered: true,
    available: true,
  },
  {
    path: "/api/public/v1/website/news/[slug]",
    label: "News-Artikel (Detail)",
    description: "Einzelner Artikel nach Slug",
    tenantFiltered: true,
    available: true,
  },
  {
    path: "/api/public/v1/website/pages/[slug]",
    label: "Website-Seite (Detail)",
    description: "Statische/Semi-statische Seiten",
    tenantFiltered: true,
    available: true,
  },
  {
    path: "/api/public/events",
    label: "Events",
    description: "Öffentliche Veranstaltungen",
    tenantFiltered: false,
    available: true,
    note: "TODO: Tenant-Filterung fehlt — alle Events aller Mandanten werden zurückgegeben.",
  },
  {
    path: "/api/public/wochenplan",
    label: "Wochenplan",
    description: "Veröffentlichte Wochenpläne",
    tenantFiltered: false,
    available: true,
    note: "TODO: Tenant-Filterung prüfen.",
  },
  {
    path: "/api/public/infoboard",
    label: "Infoboard",
    description: "Infoboard-Daten (Events, Spielplan)",
    tenantFiltered: false,
    available: true,
    note: "TODO: Tenant-Filterung — aktuell nicht multi-tenant-sicher.",
  },
  {
    path: "/api/public/v1/teams",
    label: "Teams",
    description: "Öffentliche Team-Daten",
    tenantFiltered: false,
    available: false,
    note: "Noch nicht implementiert — Phase 4: FC Allschwil Website Integration.",
  },
  {
    path: "/api/public/v1/sponsors",
    label: "Sponsoren",
    description: "Sponsor-Daten für die Website",
    tenantFiltered: false,
    available: false,
    note: "Noch nicht implementiert — Phase 4.",
  },
];

// ── Content areas catalogue ────────────────────────────────────────────────────

const CONTENT_AREAS = [
  {
    key: "news",
    label: "News",
    description: "Artikel erstellen, bearbeiten und veröffentlichen.",
    href: "/dashboard/website/news",
    icon: Newspaper,
    implemented: true,
  },
  {
    key: "pages",
    label: "Seiten",
    description: "Statische Websiteseiten verwalten.",
    href: "/dashboard/website/pages",
    icon: FileText,
    implemented: true,
  },
  {
    key: "media",
    label: "Medien",
    description: "Bilder und Mediadateien hochladen.",
    href: "/dashboard/website/media",
    icon: ImageIcon,
    implemented: true,
  },
  {
    key: "publishing",
    label: "Veröffentlichungen",
    description: "Alle Inhalte prüfen und veröffentlichen.",
    href: "/dashboard/website/publishing",
    icon: Layers,
    implemented: true,
  },
  {
    key: "teams",
    label: "Teams",
    description: "Team-Daten für die Website freigeben.",
    href: "/dashboard/teams",
    icon: Users,
    implemented: false,
    plannedPhase: "Phase 4",
  },
  {
    key: "events",
    label: "Events",
    description: "Veranstaltungen für die Website freigeben.",
    href: "/dashboard/events",
    icon: Calendar,
    implemented: false,
    plannedPhase: "Phase 4",
  },
  {
    key: "sponsors",
    label: "Sponsoren",
    description: "Sponsoren-Daten und Logos verwalten.",
    href: "#",
    icon: Shield,
    implemented: false,
    plannedPhase: "Phase 4",
  },
  {
    key: "wochenplan",
    label: "Wochenplan",
    description: "Aktiven Wochenplan auf der Website publizieren.",
    href: "/dashboard/planner",
    icon: Calendar,
    implemented: false,
    plannedPhase: "Phase 4",
  },
  {
    key: "pagebuilder",
    label: "Seiten-Builder",
    description: "Visuelle Seitengestaltung — Block-Editor.",
    href: "#",
    icon: Sparkles,
    implemented: false,
    plannedPhase: "Post-v1",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function WebsiteOverviewPage() {
  const session = await requireAnyPermission([
    PERMISSIONS.WEBSITE_MANAGE,
    PERMISSIONS.NEWS_MANAGE,
  ]);

  const tenantId = session.user?.tenantId;
  if (!tenantId) notFound();

  const ctx = await getTenantContextFromSession(tenantId);
  if (!ctx) notFound();

  const canManageSettings = hasPermission(session, PERMISSIONS.WEBSITE_MANAGE);

  const badge = publishModeBadge(ctx.websitePublishMode);

  return (
    <PageShell fullWidth>
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Website" },
          { label: "Übersicht" },
        ]}
      />
      <PageHeader
        eyebrow="Website"
        title="Website Management"
        description="Veröffentlichung, Konfiguration und öffentliche Schnittstellen für die Club-Website."
      />

      <div className="space-y-8">

        {/* ── Status banner ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
          <div className="flex items-center gap-3">
            {ctx.websiteEnabled ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-rose-500 shrink-0" />
            )}
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Website {ctx.websiteEnabled ? "aktiv" : "deaktiviert"}
              </p>
              <p className="text-xs text-[var(--muted)]">
                Öffentliche API-Endpunkte sind{" "}
                {ctx.websiteEnabled ? "freigegeben" : "gesperrt"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badge.colorClass}`}>
              {badge.label}
            </span>
            {ctx.websiteLastPublishedAt ? (
              <span className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                <Clock className="h-3.5 w-3.5" />
                Zuletzt veröffentlicht: {formatDateTime(ctx.websiteLastPublishedAt)}
              </span>
            ) : null}
            {canManageSettings && (
              <Link
                href="/dashboard/website/settings"
                className="fca-button-secondary text-xs"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Einstellungen
              </Link>
            )}
          </div>
        </div>

        {/* ── Two-column layout: Config + Publishing ────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* Website configuration */}
          <SectionCard title="Website-Konfiguration">
            <dl className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
                  Basis-URL
                </dt>
                <dd className="text-sm text-[var(--foreground)] text-right">
                  {ctx.websiteBaseUrl ? (
                    <a
                      href={ctx.websiteBaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline"
                    >
                      {ctx.websiteBaseUrl}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-[var(--muted)]">Nicht konfiguriert</span>
                  )}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
                  Sprache
                </dt>
                <dd className="text-sm text-[var(--foreground)]">
                  {ctx.websitePrimaryLanguage ?? <span className="text-[var(--muted)]">—</span>}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
                  Publish-Modus
                </dt>
                <dd>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.colorClass}`}>
                    {badge.label}
                  </span>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
                  Vier-Augen-Prinzip
                </dt>
                <dd className="text-sm">
                  {ctx.approvedDataOnly ? (
                    <span className="text-emerald-600 font-medium">Aktiviert</span>
                  ) : (
                    <span className="text-[var(--muted)]">Deaktiviert</span>
                  )}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
                  Cache-Strategie
                </dt>
                <dd className="text-sm text-[var(--foreground)]">
                  {ctx.websiteCacheStrategy ?? (
                    <span className="text-[var(--muted)]">Nicht konfiguriert</span>
                  )}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
                  Zuletzt veröffentlicht
                </dt>
                <dd className="text-sm text-[var(--foreground)]">
                  {formatDateTime(ctx.websiteLastPublishedAt)}
                </dd>
              </div>
            </dl>
            {canManageSettings && (
              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                <Link href="/dashboard/website/settings" className="fca-button-secondary text-sm">
                  <Settings2 className="h-3.5 w-3.5" />
                  Konfigurieren
                </Link>
              </div>
            )}
          </SectionCard>

          {/* Publishing controls */}
          <SectionCard title="Publishing-Steuerung">
            <div className="space-y-4">
              {/* Mode indicator */}
              <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-[var(--muted)]" />
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      Aktueller Modus
                    </span>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badge.colorClass}`}>
                    {badge.label}
                  </span>
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {ctx.websitePublishMode === "LIVE" &&
                    "Die Website ist vollständig live und für alle Besucher sichtbar."}
                  {ctx.websitePublishMode === "STAGED" &&
                    "Inhalte sind für Staging-Review bereit. Noch nicht vollständig öffentlich."}
                  {ctx.websitePublishMode === "DRAFT" &&
                    "Die Website befindet sich im Entwurfsmodus. Inhalte sind noch nicht für die Öffentlichkeit sichtbar."}
                </p>
              </div>

              {/* Last published */}
              {ctx.websiteLastPublishedAt ? (
                <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>
                    Zuletzt veröffentlicht:{" "}
                    <span className="font-medium text-[var(--foreground)]">
                      {formatDateTime(ctx.websiteLastPublishedAt)}
                    </span>
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                  <span>Noch nie veröffentlicht.</span>
                </div>
              )}

              {/* Four-eye indicator */}
              <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <div className="flex items-center gap-2">
                  <Shield className={`h-4 w-4 shrink-0 ${ctx.approvedDataOnly ? "text-emerald-500" : "text-[var(--muted)]"}`} />
                  <span className="text-xs font-medium text-[var(--foreground)]">
                    Vier-Augen-Prinzip
                  </span>
                  <span className={`ml-auto text-xs font-semibold ${ctx.approvedDataOnly ? "text-emerald-600" : "text-[var(--muted)]"}`}>
                    {ctx.approvedDataOnly ? "AN" : "AUS"}
                  </span>
                </div>
              </div>

              {/* Placeholder for full approval workflow */}
              <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] p-3 text-center">
                <p className="text-xs text-[var(--muted)]">
                  Vollständiger Freigabe-Workflow (Phase 4)
                </p>
              </div>

              {canManageSettings && (
                <Link
                  href="/dashboard/website/settings"
                  className="fca-button-primary w-full justify-center text-sm"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Publishing konfigurieren
                </Link>
              )}
            </div>
          </SectionCard>
        </div>

        {/* ── Public API overview ────────────────────────────────────────────── */}
        <SectionCard title="Öffentliche API-Endpunkte" description="Status der öffentlichen Daten-Schnittstellen für die Website.">
          <div className="space-y-2">
            {PUBLIC_API_ROUTES.map((route) => (
              <div
                key={route.path}
                className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="text-xs font-mono text-[var(--blue)]">{route.path}</code>
                    {route.tenantFiltered ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[0.7rem] font-semibold text-emerald-700">
                        Tenant-sicher
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[0.7rem] font-semibold text-amber-700">
                        TODO: Tenant-Filterung
                      </span>
                    )}
                    {!route.available && (
                      <span className="inline-flex items-center rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[0.7rem] font-semibold text-[var(--muted)]">
                        Geplant
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">{route.description}</p>
                  {route.note && (
                    <p className="mt-1 text-[0.7rem] text-amber-600 flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                      {route.note}
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  {route.available ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Aktiv
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted)]">
                      <Clock className="h-3.5 w-3.5" />
                      Ausstehend
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ── Content areas ──────────────────────────────────────────────────── */}
        <SectionCard title="Inhaltsbereiche" description="Verwalte und veröffentliche Website-Inhalte über die einzelnen Module.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CONTENT_AREAS.map((area) => {
              const Icon = area.icon;
              return (
                <div
                  key={area.key}
                  className={[
                    "relative rounded-[var(--radius-xl)] border p-4 transition",
                    area.implemented
                      ? "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)] hover:shadow-sm cursor-pointer"
                      : "border-dashed border-[var(--border)] bg-[var(--surface-2)] opacity-70",
                  ].join(" ")}
                >
                  {area.implemented ? (
                    <Link href={area.href} className="absolute inset-0 rounded-[var(--radius-xl)]" aria-label={area.label} />
                  ) : null}
                  <div className="flex items-start gap-3">
                    <div className={`rounded-lg p-2 ${area.implemented ? "bg-[var(--accent-muted)]" : "bg-[var(--surface-3)]"}`}>
                      <Icon className={`h-4 w-4 ${area.implemented ? "text-[var(--accent)]" : "text-[var(--muted)]"}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {area.label}
                        </p>
                        {!area.implemented && area.plannedPhase && (
                          <span className="rounded-full bg-[var(--surface-3)] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[var(--muted)]">
                            {area.plannedPhase}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        {area.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* ── Quick links ────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/website/publishing" className="fca-button-secondary text-sm">
            <Layers className="h-3.5 w-3.5" />
            Veröffentlichungen
          </Link>
          <Link href="/dashboard/website/news" className="fca-button-secondary text-sm">
            <Newspaper className="h-3.5 w-3.5" />
            News
          </Link>
          <Link href="/dashboard/website/pages" className="fca-button-secondary text-sm">
            <FileText className="h-3.5 w-3.5" />
            Seiten
          </Link>
          <Link href="/dashboard/website/media" className="fca-button-secondary text-sm">
            <ImageIcon className="h-3.5 w-3.5" />
            Medien
          </Link>
          {canManageSettings && (
            <Link href="/dashboard/website/settings" className="fca-button-secondary text-sm">
              <Settings2 className="h-3.5 w-3.5" />
              Einstellungen
            </Link>
          )}
          {ctx.websiteBaseUrl ? (
            <a
              href={ctx.websiteBaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="fca-button-secondary text-sm"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Website öffnen
            </a>
          ) : null}
        </div>

        {/* ── Documentation note ─────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
          <BookOpen className="h-4 w-4 text-[var(--muted)] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">
              Phase 4: FC Allschwil Website ↔ WebApp Integration
            </p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Die vollständige Integration (Team-Publishing, Match-Publishing, Event-Publishing,
              Sponsor-Publishing, Homepage-Blöcke, Cache-Invalidierung) wird in Phase 4 implementiert.
              Diese Übersicht zeigt den aktuellen Implementierungsstand und offene TODOs.
            </p>
          </div>
        </div>

      </div>
    </PageShell>
  );
}
