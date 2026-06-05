import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Globe,
  ExternalLink,
  CheckCircle,
  XCircle,
  Settings2,
  Info,
} from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getWebsiteConfig, getWebsiteSections } from "@/lib/website/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";

// ---------------------------------------------------------------------------
// Admin → Website-Integration
//
// Platform-level overview of the website integration configuration.
// Tenant admins can also reach the full settings at /dashboard/website/settings.
// This page surfaces the current state and links to management pages.
// ---------------------------------------------------------------------------

export default async function AdminWebsitePage() {
  const session = await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  const tenantId = session.user?.tenantId;
  if (!tenantId) notFound();

  const [config, sections] = await Promise.all([
    getWebsiteConfig(tenantId).catch(() => null),
    getWebsiteSections(tenantId).catch(() => []),
  ]);

  if (!config) notFound();

  const publishedCount = sections.filter((s) => s.status === "PUBLISHED").length;

  const labelClass =
    "text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]";

  return (
    <div className="max-w-2xl space-y-8">
      <AdminSectionHeader
        eyebrow="Admin"
        title="Website-Integration"
        description="Konfiguration der öffentlichen Website-Integration für diesen Tenant. Hier werden die Domain, der Master-Schalter und die Datenschutz-Einstellungen angezeigt."
      />

      {/* ── Current config summary ─────────────────────────────────────────── */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-[var(--muted)]" />
            <span className="text-sm font-semibold text-[var(--foreground)]">
              Aktuelle Konfiguration
            </span>
          </div>
          <Link
            href="/dashboard/website/settings"
            className="flex items-center gap-1 text-[12px] font-medium text-[var(--blue)] hover:underline"
          >
            Bearbeiten
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="sce-detail-section-body">
          <dl className="grid gap-4 sm:grid-cols-2">
            {/* Domain */}
            <div>
              <dt className={labelClass}>Öffentliche Domain</dt>
              <dd className="mt-1">
                {config.websiteDomain ? (
                  <a
                    href={`https://${config.websiteDomain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-sm text-[var(--blue)] hover:underline"
                  >
                    {config.websiteDomain}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-sm italic text-[var(--muted)]">
                    Nicht konfiguriert
                  </span>
                )}
              </dd>
            </div>

            {/* Website enabled */}
            <div>
              <dt className={labelClass}>Website aktiviert</dt>
              <dd className="mt-1 flex items-center gap-1.5">
                {config.websiteEnabled ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700">Aktiv</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-rose-500" />
                    <span className="text-sm font-medium text-rose-700">Deaktiviert</span>
                  </>
                )}
              </dd>
            </div>

            {/* Approved data only */}
            <div>
              <dt className={labelClass}>Nur freigegebene Daten</dt>
              <dd className="mt-1 flex items-center gap-1.5">
                {config.approvedDataOnly ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium text-blue-700">Aktiv</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-[var(--muted)]" />
                    <span className="text-sm text-[var(--muted)]">Inaktiv</span>
                  </>
                )}
              </dd>
            </div>

            {/* Sections summary */}
            <div>
              <dt className={labelClass}>Publizierte Sektionen</dt>
              <dd className="mt-1">
                <span className="text-sm font-semibold text-[var(--foreground)]">
                  {publishedCount}
                </span>
                <span className="text-sm text-[var(--muted)]"> / {sections.length}</span>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* ── Data sources overview ──────────────────────────────────────────── */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header flex items-center gap-2">
          <Info className="h-4 w-4 text-[var(--muted)]" />
          <span className="text-sm font-semibold text-[var(--foreground)]">
            Verfügbare Datenquellen für die Website
          </span>
        </div>
        <div className="sce-detail-section-body">
          <p className="mb-4 text-[12px] text-[var(--muted)]">
            Die öffentliche Website konsumiert diese Datenquellen aus der Admin-App.
            Daten werden per API-Feed bereitgestellt — die Website ist ein separates Projekt.
          </p>
          <div className="space-y-2">
            {[
              {
                label: "Teams",
                desc: "Mannschaften mit Saison, Kader und Trainer",
                href: "/dashboard/teams",
                available: true,
              },
              {
                label: "Events",
                desc: "Matches, Turniere, Trainings mit Publikationsflags",
                href: "/dashboard/events",
                available: true,
              },
              {
                label: "Wochenplan",
                desc: "Aktiver Wochenplan-Variant mit Publikationsstatus",
                href: "/dashboard/planner/week",
                available: true,
              },
              {
                label: "Sponsoren",
                desc: "Sponsor-Konfiguration",
                href: "#",
                available: false,
              },
              {
                label: "News / Inhalte",
                desc: "Redaktionelle Inhalte und Artikel",
                href: "#",
                available: false,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3"
              >
                {item.available ? (
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <div className="h-4 w-4 shrink-0 rounded-full border-2 border-dashed border-[var(--muted)]" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--foreground)]">{item.label}</p>
                  <p className="text-[11px] text-[var(--muted)]">{item.desc}</p>
                </div>
                {item.available ? (
                  <Link
                    href={item.href}
                    className="shrink-0 text-[11px] font-medium text-[var(--blue)] hover:underline"
                  >
                    Öffnen →
                  </Link>
                ) : (
                  <span className="shrink-0 rounded-full border border-dashed border-[var(--muted)] px-2 py-0.5 text-[10px] text-[var(--muted)]">
                    Kommt bald
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Quick links ────────────────────────────────────────────────────── */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-[var(--muted)]" />
          <span className="text-sm font-semibold text-[var(--foreground)]">
            Verwaltung
          </span>
        </div>
        <div className="sce-detail-section-body">
          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              href="/dashboard/website"
              className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
            >
              <Globe className="h-4 w-4 shrink-0 text-[var(--text-2)]" />
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Website-Übersicht
                </p>
                <p className="text-[11px] text-[var(--muted)]">
                  Dashboard & Publikationsstatus
                </p>
              </div>
              <ArrowRight className="ml-auto h-3.5 w-3.5 text-[var(--muted)]" />
            </Link>
            <Link
              href="/dashboard/website/sections"
              className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
            >
              <Settings2 className="h-4 w-4 shrink-0 text-[var(--text-2)]" />
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Sektionen
                </p>
                <p className="text-[11px] text-[var(--muted)]">
                  Freigabe-Workflow verwalten
                </p>
              </div>
              <ArrowRight className="ml-auto h-3.5 w-3.5 text-[var(--muted)]" />
            </Link>
            <Link
              href="/dashboard/website/settings"
              className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
            >
              <Globe className="h-4 w-4 shrink-0 text-[var(--text-2)]" />
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Einstellungen
                </p>
                <p className="text-[11px] text-[var(--muted)]">
                  Domain, Schalter, Datenschutz
                </p>
              </div>
              <ArrowRight className="ml-auto h-3.5 w-3.5 text-[var(--muted)]" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
