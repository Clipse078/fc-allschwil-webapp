/**
 * lib/cms/sections.ts
 *
 * Canonical CMS section and feature definitions for the Website Management hub.
 *
 * This is the authoritative source of truth for:
 *  - CMS information architecture (sections + features)
 *  - Feature availability status
 *  - Route association per feature
 *  - Permission requirements (informational)
 *
 * Do not duplicate feature descriptions or routes elsewhere.
 * Future roadmap items are explicitly documented here as "coming_next" or "future".
 */

import { CMS_ROUTES } from "./routes";
import type { CmsSection } from "./types";

export const CMS_SECTIONS: CmsSection[] = [
  // ── Content ────────────────────────────────────────────────────────────────
  {
    key: "content",
    label: "Inhalte",
    description: "Texte, Bilder und Medien für den Webauftritt pflegen.",
    features: [
      {
        key: "news",
        label: "News",
        description: "Artikel erstellen, bearbeiten und veröffentlichen.",
        status: "available",
        href: CMS_ROUTES.news,
        requiredPermissions: ["news.manage", "website.manage"],
      },
      {
        key: "pages",
        label: "Seiten",
        description: "Statische Webseiten mit SEO-Feldern und Freigabe-Workflow.",
        status: "available",
        href: CMS_ROUTES.pages,
        requiredPermissions: ["website.manage"],
      },
      {
        key: "media",
        label: "Mediathek",
        description: "Bilder und Videos zentral verwalten und in Inhalten verwenden.",
        status: "available",
        href: CMS_ROUTES.media,
        requiredPermissions: ["news.manage", "website.manage"],
      },
      {
        key: "homepage_builder",
        label: "Homepage Builder",
        description: "Konfigurierbare Homepage-Sektionen verwalten und für die öffentliche API bereitstellen.",
        status: "foundation",
        href: CMS_ROUTES.homepage,
        requiredPermissions: ["website.manage"],
      },
    ],
  },

  // ── Publishing ─────────────────────────────────────────────────────────────
  {
    key: "publishing",
    label: "Publishing",
    description: "Inhalte prüfen, freigeben, planen und terminieren.",
    features: [
      {
        key: "publishing_queue",
        label: "Publishing-Cockpit",
        description: "Einheitliche Übersicht über alle Inhalte mit Status-Workflow.",
        status: "available",
        href: CMS_ROUTES.publishing,
        requiredPermissions: ["news.manage", "website.manage"],
      },
      {
        key: "drafts",
        label: "Entwürfe",
        description: "Alle Entwürfe gesammelt anzeigen und weiterbearbeiten.",
        status: "foundation",
        href: CMS_ROUTES.publishing,
        requiredPermissions: ["news.manage", "website.manage"],
      },
      {
        key: "scheduled",
        label: "Geplante Inhalte",
        description: "Termine für automatische Veröffentlichungen planen.",
        status: "foundation",
        href: CMS_ROUTES.publishing,
        requiredPermissions: ["news.manage", "website.manage"],
      },
      {
        key: "preview",
        label: "Vorschau-Workflow",
        description: "Inhalte vor Veröffentlichung auf der Website vorschauen.",
        status: "coming_next",
        requiredPermissions: ["website.manage"],
      },
    ],
  },

  // ── Structure ──────────────────────────────────────────────────────────────
  {
    key: "structure",
    label: "Struktur",
    description: "Navigation, Blöcke und URL-Weiterleitungen verwalten.",
    features: [
      {
        key: "navigation",
        label: "Navigation",
        description: "Menüstruktur und Seitenbaum der Website konfigurieren.",
        status: "coming_next",
        requiredPermissions: ["website.manage"],
      },
      {
        key: "blocks",
        label: "Block-Bibliothek",
        description: "Wiederverwendbare Inhaltsblöcke definieren und verwalten.",
        status: "coming_next",
        requiredPermissions: ["website.manage"],
      },
      {
        key: "redirects",
        label: "Weiterleitungen",
        description: "URL-Redirects pflegen und bestehende Verlinkungen absichern.",
        status: "future",
        requiredPermissions: ["website.manage"],
      },
    ],
  },

  // ── Governance ─────────────────────────────────────────────────────────────
  {
    key: "governance",
    label: "Governance",
    description: "Freigabe-Workflows, Berechtigungen und redaktionelle Kontrolle.",
    features: [
      {
        key: "four_eyes",
        label: "Vier-Augen-Prinzip",
        description: "Freigabe-Workflow für alle Inhalte aktivieren.",
        status: "available",
        href: CMS_ROUTES.settings,
        requiredPermissions: ["website.manage"],
      },
      {
        key: "review_workflow",
        label: "Redaktioneller Workflow",
        description: "Submit → Review → Approve für News und Seiten.",
        status: "foundation",
        href: CMS_ROUTES.publishing,
        requiredPermissions: ["news.manage", "website.manage"],
      },
      {
        key: "approval_workflow",
        label: "Freigabe-Dashboard",
        description: "Dediziertes Dashboard für Redakteure und Freigeber.",
        status: "coming_next",
        requiredPermissions: ["website.manage"],
      },
      {
        key: "permissions",
        label: "Redaktions-Rollen",
        description: "Granulare Rollen für Autoren, Redakteure und Administratoren.",
        status: "future",
        requiredPermissions: ["website.manage"],
      },
    ],
  },

  // ── Configuration ──────────────────────────────────────────────────────────
  {
    key: "configuration",
    label: "Konfiguration",
    description: "SEO, Metadaten und Website-Einstellungen.",
    features: [
      {
        key: "website_settings",
        label: "Website-Einstellungen",
        description: "Veröffentlichung, Vier-Augen-Prinzip und Basis-Konfiguration.",
        status: "available",
        href: CMS_ROUTES.settings,
        requiredPermissions: ["website.manage"],
      },
      {
        key: "seo",
        label: "SEO-Verwaltung",
        description: "Meta-Titel, Descriptions und strukturierte Daten verwalten.",
        status: "foundation",
        href: CMS_ROUTES.pages,
        requiredPermissions: ["website.manage"],
      },
      {
        key: "seo_global",
        label: "Globale SEO-Einstellungen",
        description: "Standardwerte und siteweite SEO-Konfiguration.",
        status: "coming_next",
        requiredPermissions: ["website.manage"],
      },
    ],
  },
];
