"use client";

/**
 * app/dev-preview/DevPreviewClient.tsx
 *
 * Interactive demo client for the Live Preview Canvas.
 * Tests all block renderers and the viewport toolbar.
 */

import { useState } from "react";
import LivePreviewCanvas, {
  ViewportToolbar,
  type ViewportMode,
  type CanvasSection,
} from "@/components/admin/page-builder/LivePreviewCanvas";

// ---------------------------------------------------------------------------
// Mock section data for testing all 9 block types
// ---------------------------------------------------------------------------

const MOCK_SECTIONS: CanvasSection[] = [
  {
    id: "hero-1",
    type: "hero",
    label: "Hero Banner",
    isEnabled: true,
    publishStatus: "PUBLISHED",
    config: {
      title: "FC Allschwil — Herzlich Willkommen",
      subtitle: "Leidenschaft für Fussball seit 1921",
      ctaLabel: "Jetzt Mitglied werden",
      ctaUrl: "/mitgliedschaft",
      _layout: {
        width: "full",
        spacingTop: "xl",
        spacingBottom: "xl",
        theme: "dark",
        background: {
          type: "gradient",
          gradientPreset: "dark-slate",
        },
      },
    },
  },
  {
    id: "news-1",
    type: "newsTeaser",
    label: "Aktuelle News",
    isEnabled: true,
    publishStatus: "PUBLISHED",
    config: {
      heading: "Neuigkeiten",
      itemCount: 3,
      _layout: {
        width: "normal",
        spacingTop: "md",
        spacingBottom: "md",
        theme: "light",
      },
    },
  },
  {
    id: "split-1",
    type: "splitContentCards",
    label: "Split Content",
    isEnabled: true,
    publishStatus: "PUBLISHED",
    config: {
      eyebrow: "Über uns",
      headline: "Mehr als nur ein Sportverein",
      bodyRichText: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Wir sind ein lebendiger Verein mit über 500 Mitgliedern und einem starken Gemeinschaftssinn.",
              },
            ],
          },
        ],
      },
      layout: "TEXT_LEFT_CARDS_RIGHT",
      cards: [
        {
          id: "card-1",
          title: "500+ Mitglieder",
          body: "Grossartige Gemeinschaft aus Sportlerinnen und Sportlern.",
          variant: "orange",
        },
        {
          id: "card-2",
          title: "15 Teams",
          body: "Von U8 bis zu den Aktiven in allen Altersstufen.",
          variant: "blue",
        },
        {
          id: "card-3",
          title: "Seit 1921",
          body: "Über 100 Jahre Vereinsgeschichte im Kanton Basel.",
          variant: "neutral",
        },
      ],
      _layout: {
        width: "normal",
        spacingTop: "lg",
        spacingBottom: "lg",
        theme: "soft",
        columns: "50/50",
      },
    },
  },
  {
    id: "events-1",
    type: "eventsTeaser",
    label: "Nächste Spiele",
    isEnabled: true,
    publishStatus: "PUBLISHED",
    config: {
      heading: "Nächste Veranstaltungen",
      itemCount: 4,
      surface: "homepage",
      _layout: {
        width: "normal",
        spacingTop: "md",
        spacingBottom: "md",
        theme: "light",
      },
    },
  },
  {
    id: "teams-1",
    type: "teamsTeaser",
    label: "Mannschaftsübersicht",
    isEnabled: true,
    publishStatus: "PUBLISHED",
    config: {
      heading: "Unsere Teams",
      itemCount: 6,
      _layout: {
        width: "wide",
        spacingTop: "md",
        spacingBottom: "md",
        theme: "soft",
      },
    },
  },
  {
    id: "cta-1",
    type: "callToAction",
    label: "Mitglied werden",
    isEnabled: true,
    publishStatus: "PUBLISHED",
    config: {
      title: "Werde Teil unserer Mannschaft",
      body: "Komm zu unserem Schnuppertraining und erlebe den Vereinsgeist!",
      primaryLabel: "Jetzt beitreten",
      primaryUrl: "/mitgliedschaft",
      secondaryLabel: "Mehr erfahren",
      secondaryUrl: "/ueber-uns",
      _layout: {
        width: "normal",
        spacingTop: "lg",
        spacingBottom: "lg",
        theme: "club",
        background: {
          type: "gradient",
          gradientPreset: "club-warm",
        },
      },
    },
  },
  {
    id: "weekplan-1",
    type: "weekplanTeaser",
    label: "Wochenplan",
    isEnabled: true,
    publishStatus: "DRAFT",
    config: {
      heading: "Diese Woche",
      _layout: {
        width: "normal",
        spacingTop: "sm",
        spacingBottom: "sm",
        theme: "light",
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Demo component
// ---------------------------------------------------------------------------

export default function DevPreviewClient() {
  const [viewport, setViewport] = useState<ViewportMode>("desktop");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftConfigs, setDraftConfigs] = useState<Map<string, Record<string, unknown>>>(new Map());

  // Demo: allow editing hero title inline to test live preview
  const [heroTitle, setHeroTitle] = useState("FC Allschwil — Herzlich Willkommen");
  const [heroSubtitle, setHeroSubtitle] = useState("Leidenschaft für Fussball seit 1921");

  // Update draft config for hero whenever title/subtitle changes
  function updateHeroDraft(title: string, subtitle: string) {
    const heroSection = MOCK_SECTIONS.find((s) => s.id === "hero-1");
    if (!heroSection) return;
    const updated = {
      ...heroSection.config,
      title,
      subtitle,
    };
    setDraftConfigs((prev) => {
      const next = new Map(prev);
      next.set("hero-1", updated);
      return next;
    });
  }

  const selectedSection = MOCK_SECTIONS.find((s) => s.id === selectedId);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-screen-2xl mx-auto">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900">Live Preview Canvas — Dev Demo</h1>
          <p className="text-sm text-gray-600 mt-1">
            Testing all 9 block renderers with split-pane layout and viewport controls.
          </p>
        </div>

        {/* Demo split-pane */}
        <div className="flex gap-0 rounded-xl border border-gray-200 overflow-hidden bg-white shadow-lg" style={{ height: "calc(100vh - 8rem)" }}>
          {/* Mini inspector (demo) */}
          <div className="w-72 shrink-0 border-r border-gray-200 flex flex-col bg-gray-50">
            <div className="px-3 py-2 border-b border-gray-200 bg-white">
              <p className="text-xs font-semibold text-gray-700">Inspector Demo</p>
              <p className="text-[11px] text-gray-500">{MOCK_SECTIONS.length} Sektionen</p>
            </div>

            {/* Section list */}
            <div className="flex-1 overflow-y-auto">
              {MOCK_SECTIONS.map((section, idx) => (
                <div
                  key={section.id}
                  className={`flex items-center gap-2 px-3 py-2 border-b border-gray-100 cursor-pointer transition ${
                    selectedId === section.id ? "bg-blue-50 border-l-2 border-l-blue-500" : "hover:bg-gray-100"
                  }`}
                  onClick={() => setSelectedId(selectedId === section.id ? null : section.id)}
                >
                  <span className="text-[11px] text-gray-400 w-4 text-right">{idx + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{section.label}</p>
                    <p className="text-[10px] text-gray-500 truncate">{section.type}</p>
                  </div>
                  <span className={`h-1.5 w-1.5 rounded-full ${section.publishStatus === "PUBLISHED" ? "bg-emerald-400" : "bg-amber-300"}`} />
                </div>
              ))}
            </div>

            {/* Demo live editing area */}
            {selectedSection?.type === "hero" && (
              <div className="border-t border-gray-200 p-3 bg-white space-y-2">
                <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">Live Edit — Hero</p>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">Titel</label>
                  <input
                    className="w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={heroTitle}
                    onChange={(e) => {
                      setHeroTitle(e.target.value);
                      updateHeroDraft(e.target.value, heroSubtitle);
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">Untertitel</label>
                  <input
                    className="w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={heroSubtitle}
                    onChange={(e) => {
                      setHeroSubtitle(e.target.value);
                      updateHeroDraft(heroTitle, e.target.value);
                    }}
                  />
                </div>
                <p className="text-[10px] text-blue-600">← Änderungen sofort im Canvas sichtbar</p>
              </div>
            )}

            {selectedSection && selectedSection.type !== "hero" && (
              <div className="border-t border-gray-200 p-3 bg-white">
                <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1">Ausgewählt</p>
                <p className="text-xs text-gray-800 font-medium">{selectedSection.label}</p>
                <p className="text-[11px] text-gray-500">{selectedSection.type}</p>
                <p className="text-[10px] text-gray-400 mt-1">Im echten Builder: Inspector zeigt Live-Config-Felder</p>
              </div>
            )}
          </div>

          {/* Canvas */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-white">
              <div className="text-xs text-gray-600 font-medium">
                {selectedId ? (
                  <span className="text-blue-600">
                    Ausgewählt: {selectedSection?.label}
                  </span>
                ) : (
                  "Klicke auf eine Sektion im Canvas"
                )}
              </div>
              <ViewportToolbar viewport={viewport} onChange={setViewport} />
              <div className="text-xs text-gray-400">
                {MOCK_SECTIONS.length} Blöcke
              </div>
            </div>

            <LivePreviewCanvas
              sections={MOCK_SECTIONS}
              draftConfigs={draftConfigs}
              selectedId={selectedId}
              onSelectSection={(id) => setSelectedId(selectedId === id ? null : id)}
              viewport={viewport}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
