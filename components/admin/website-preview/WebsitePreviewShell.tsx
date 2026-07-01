"use client";

/**
 * WebsitePreviewShell
 *
 * Reusable full-screen preview overlay for admin Website / Page builders.
 *
 * Features:
 *   - Draft Preview: shows all sections (including disabled / unpublished)
 *     with visual status indicators. Sections not yet published are dimmed.
 *   - Published Preview: shows only active + published sections, mirroring
 *     public website output.
 *   - Device Preview: constrains the frame to Desktop / Tablet / Mobile widths.
 *   - Read-only: never mutates data, never calls publish endpoints.
 *
 * Usage:
 *   <WebsitePreviewShell
 *     title="My Page"
 *     subtitle="/my-page"
 *     sections={normalizedSections}
 *     mode={previewMode}
 *     device={previewDevice}
 *     onModeChange={setPreviewMode}
 *     onDeviceChange={setPreviewDevice}
 *     onClose={() => setShowPreview(false)}
 *     loading={loading}
 *     error={error}
 *   />
 *
 * The caller is responsible for data fetching and normalising sections to
 * the WebsitePreviewSection shape before passing them in.
 */

import { Suspense } from "react";
import { RefreshCw, FileEdit } from "lucide-react";
import dynamic from "next/dynamic";
import WebsitePreviewToolbar from "./WebsitePreviewToolbar";
import WebsitePreviewFrame from "./WebsitePreviewFrame";
import WebsitePreviewEmptyState from "./WebsitePreviewEmptyState";
import type { PreviewMode } from "./WebsitePreviewModeSwitch";
import type { PreviewDevice } from "./WebsitePreviewDeviceSwitch";

const WebsiteSectionDispatcher = dynamic(
  () => import("@/components/website/WebsiteSectionDispatcher"),
  {
    ssr: false,
    loading: () => <div className="h-24 animate-pulse bg-gray-50" />,
  },
);

// ---------------------------------------------------------------------------
// Section shape (normalised by the caller)
// ---------------------------------------------------------------------------

/**
 * Normalised section shape accepted by WebsitePreviewShell.
 *
 * Callers map their own section type to this:
 *   - isDraft:    publishStatus !== "PUBLISHED"  (page sections)
 *                 section.isDraft                (homepage sections)
 *   - isEnabled:  section.isEnabled              (both)
 */
export type WebsitePreviewSection = {
  id: string;
  type: string;
  label: string;
  isDraft: boolean;
  isEnabled: boolean;
  config: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Known block types that have a visual renderer in WebsiteSectionDispatcher
// ---------------------------------------------------------------------------

const RENDERABLE_TYPES = new Set([
  "hero",
  "newsTeaser",
  "teamsTeaser",
  "sponsorsTeaser",
  "splitContentCards",
  "callToAction",
  "eventsTeaser",
  "weekplanTeaser",
]);

// ---------------------------------------------------------------------------
// Config summary fallback for blocks without a visual renderer
// ---------------------------------------------------------------------------

function ConfigSummary({
  type,
  config,
}: {
  type: string;
  config: Record<string, unknown>;
}) {
  const json = JSON.stringify(config, null, 2);
  const preview = json.length > 300 ? `${json.slice(0, 300)}…` : json;
  return (
    <div className="px-5 py-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
        {type} — kein visueller Renderer
      </p>
      <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[10px] font-mono text-[var(--text-2)] whitespace-pre-wrap">
        {preview}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  title: string;
  subtitle?: string;
  sections: WebsitePreviewSection[];
  mode: PreviewMode;
  device: PreviewDevice;
  onModeChange: (mode: PreviewMode) => void;
  onDeviceChange: (device: PreviewDevice) => void;
  onClose: () => void;
  loading?: boolean;
  error?: string | null;
};

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export default function WebsitePreviewShell({
  title,
  subtitle,
  sections,
  mode,
  device,
  onModeChange,
  onDeviceChange,
  onClose,
  loading = false,
  error = null,
}: Props) {
  const visibleSections =
    mode === "published"
      ? sections.filter((s) => s.isEnabled && !s.isDraft)
      : sections;

  const draftCount = sections.filter((s) => s.isDraft).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--background)]">
      <WebsitePreviewToolbar
        title={title}
        subtitle={subtitle}
        mode={mode}
        onModeChange={onModeChange}
        device={device}
        onDeviceChange={onDeviceChange}
        onClose={onClose}
      />

      <WebsitePreviewFrame device={device}>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[var(--muted)]">
            <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
            <span className="text-sm">Lädt Vorschau…</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center px-6 py-16 text-center text-sm text-rose-600">
            {error}
          </div>
        ) : visibleSections.length === 0 ? (
          <WebsitePreviewEmptyState mode={mode} />
        ) : (
          <div>
            {visibleSections.map((section) => {
              const isDimmed = section.isDraft || !section.isEnabled;
              return (
                <div
                  key={section.id}
                  className={`border-b border-[var(--border)] last:border-0 transition-opacity ${
                    isDimmed ? "opacity-50" : ""
                  }`}
                >
                  {/* Status strip — only shown in draft mode */}
                  {mode === "draft" && (
                    <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-1.5">
                      <span className="truncate text-[11px] font-medium text-[var(--foreground)]">
                        {section.label}
                      </span>
                      <div className="ml-2 flex shrink-0 items-center gap-1">
                        {!section.isEnabled && (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                            Deaktiviert
                          </span>
                        )}
                        {section.isDraft ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
                            <FileEdit className="h-2.5 w-2.5" />
                            Entwurf
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">
                            Veröffentlicht
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Visual renderer */}
                  {RENDERABLE_TYPES.has(section.type) ? (
                    <Suspense
                      fallback={
                        <div className="h-16 animate-pulse bg-gray-50" />
                      }
                    >
                      <WebsiteSectionDispatcher
                        section={{
                          id: section.id,
                          type: section.type,
                          config: section.config,
                        }}
                        previewMode
                      />
                    </Suspense>
                  ) : (
                    <ConfigSummary type={section.type} config={section.config} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </WebsitePreviewFrame>

      {/* Footer status bar */}
      <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[11px] text-[var(--muted)]">
        <div className="flex items-center gap-3">
          <span>
            {sections.length} Sektion{sections.length !== 1 ? "en" : ""} gesamt
          </span>
          {mode === "published" && (
            <span>· {visibleSections.length} sichtbar</span>
          )}
          {mode === "draft" && draftCount > 0 && (
            <span>
              · {draftCount} Entwurf{draftCount !== 1 ? "e" : ""}
            </span>
          )}
        </div>
        <div>
          {mode === "draft" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
              <FileEdit className="h-2.5 w-2.5" />
              Draft Preview
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
              Published Preview
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
