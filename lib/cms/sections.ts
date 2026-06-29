/**
 * lib/cms/sections.ts
 *
 * Canonical CMS section and feature definitions for the Website Management hub.
 * Updated for CMS V4.2 — Website Platform UX Unification.
 *
 * This is the authoritative source of truth for:
 *  - CMS information architecture (sections + features)
 *  - Feature availability status
 *  - Route association per feature
 *  - Permission requirements (informational)
 *
 * Do not duplicate feature descriptions or routes elsewhere.
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
        description: "Artikel erstellen, bearbeiten und veröffentlichen. V4.2: Rich Text, Autosave, Inspector, SEO, Revision History.",
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
        label: "Mediathek (DAM)",
        description: "True DAM: Bilder und Videos zentral verwalten, Fokuspunkt, Alt-Text, Ordner, Tags, Verwendungsnachweis.",
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
      {
        key: "page_builder",
        label: "Page Builder",
        description: "Block-basierter Page Builder mit Drag & Drop, Autosave, Vorschau und Versionshistorie.",
        status: "available",
        href: CMS_ROUTES.pages,
        requiredPermissions: ["website.manage"],
      },
    ],
  },

  // ── Component Library ──────────────────────────────────────────────────────
  {
    key: "component_library",
    label: "Komponenten-Bibliothek",
    description: "Wiederverwendbare Inhaltselemente — einmal erstellen, überall einsetzen.",
    features: [
      {
        key: "reusable_components",
        label: "Komponenten-Bibliothek",
        description: "CTA, FAQ, Zitat, Statistik, Ankündigung, Hero, Timeline, Team-Raster, Anmelde-CTA, Footer-Block.",
        status: "available",
        href: CMS_ROUTES.components,
        requiredPermissions: ["website.manage"],
      },
      {
        key: "blocks",
        label: "Block-Bibliothek",
        description: "Wiederverwendbare Inhaltsblöcke für den Page Builder definieren und verwalten.",
        status: "foundation",
        href: CMS_ROUTES.blocks,
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
        description: "Einheitliche Übersicht über alle Inhalte mit Status-Workflow (inkl. Abgelaufen-Status).",
        status: "available",
        href: CMS_ROUTES.publishing,
        requiredPermissions: ["news.manage", "website.manage"],
      },
      {
        key: "drafts",
        label: "Entwürfe",
        description: "Alle Entwürfe gesammelt anzeigen und weiterbearbeiten.",
        status: "available",
        href: CMS_ROUTES.publishing,
        requiredPermissions: ["news.manage", "website.manage"],
      },
      {
        key: "scheduled",
        label: "Geplante Inhalte",
        description: "Termine für automatische Veröffentlichungen planen.",
        status: "available",
        href: CMS_ROUTES.publishing,
        requiredPermissions: ["news.manage", "website.manage"],
      },
      {
        key: "preview",
        label: "Vorschau-Workflow",
        description: "Inhalte vor Veröffentlichung auf der Website vorschauen.",
        status: "available",
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
        label: "Navigation Builder",
        description: "Visueller Navigation Builder: Drag & Drop, Inspector, Mega-Menü, Zeitplanung, Mobile-Vorschau.",
        status: "available",
        href: CMS_ROUTES.navigation,
        requiredPermissions: ["website.manage"],
      },
      {
        key: "redirects",
        label: "Weiterleitungen",
        description: "URL-Redirects (301/302) pflegen und bestehende Verlinkungen absichern.",
        status: "available",
        href: CMS_ROUTES.settings,
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
        status: "available",
        href: CMS_ROUTES.publishing,
        requiredPermissions: ["news.manage", "website.manage"],
      },
      {
        key: "approval_workflow",
        label: "Freigabe-Dashboard",
        description: "Redaktionelle Freigabe-Queue für Homepage-Sektionen.",
        status: "available",
        href: CMS_ROUTES.review,
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
    label: "Website-Konfiguration",
    description: "SEO, Analytics, Social Media, PWA, Cookie-Banner, Favicon und technische Einstellungen.",
    features: [
      {
        key: "website_settings",
        label: "Allgemeine Einstellungen",
        description: "Veröffentlichung, Vier-Augen-Prinzip und Basis-Konfiguration.",
        status: "available",
        href: CMS_ROUTES.settings,
        requiredPermissions: ["website.manage"],
      },
      {
        key: "seo",
        label: "SEO-Verwaltung",
        description: "Meta-Titel, Descriptions und strukturierte Daten verwalten.",
        status: "available",
        href: CMS_ROUTES.settings,
        requiredPermissions: ["website.manage"],
      },
      {
        key: "seo_global",
        label: "Globale SEO-Einstellungen",
        description: "Siteweite SEO-Konfiguration: Titel-Template, Canonical-URL, OG-Bild, Twitter-Card.",
        status: "available",
        href: CMS_ROUTES.settings,
        requiredPermissions: ["website.manage"],
      },
      {
        key: "analytics",
        label: "Analytics",
        description: "Google Analytics 4 und Google Tag Manager einbinden.",
        status: "available",
        href: CMS_ROUTES.settings,
        requiredPermissions: ["website.manage"],
      },
      {
        key: "technical_config",
        label: "Technische Konfiguration",
        description: "robots.txt, Sitemap, Favicon, PWA-Manifest, Cookie-Banner.",
        status: "available",
        href: CMS_ROUTES.settings,
        requiredPermissions: ["website.manage"],
      },
    ],
  },
];
