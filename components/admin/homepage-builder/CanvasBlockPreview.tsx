"use client";

/**
 * components/admin/homepage-builder/CanvasBlockPreview.tsx
 *
 * Shared visual block preview for the admin canvas.
 *
 * Used by HomepageCanvasSection (and thereby by both Homepage Builder and
 * Website Page Builder, since PageBuilderCanvas adapts to HomepageCanvas).
 *
 * Renders the block's actual visual output — the same component used on the
 * public website — in previewMode so the canvas feels like Webflow/Builder.io.
 *
 * BLOCK COVERAGE
 *   hero              → HeroRenderer         (full visual)
 *   callToAction      → CallToActionRenderer  (full visual)
 *   splitContentCards → SplitContentCardsRenderer (full visual, rich text)
 *   data-driven       → DataDrivenPlaceholder (informational placeholder)
 *   customContent     → ComingSoonPlaceholder
 *   (unknown)         → UnknownBlockPlaceholder
 *
 * BACKGROUND IMAGE RESOLUTION
 *   When a section has `config._layout.background.type === "image"`, the
 *   mediaAssetId is resolved to a URL via GET /api/media/[id] on mount and
 *   whenever the assetId changes (live inspector draft updates). The resolved
 *   URL is forwarded to the renderer as `backgroundImageUrl` so SectionShell
 *   can apply it as a CSS backgroundImage. This mirrors the behaviour of
 *   HomepageMediaField (which does the same resolution for the inspector
 *   thumbnail). Public renderers are unaffected — they do not receive this prop.
 *
 * INLINE EDITING (Slice K)
 *   When `onFieldChange` is provided (admin canvas only), text fields inside
 *   the rendered block become inline editable. The pointer-events-none wrapper
 *   in HomepageCanvasSection must be removed by the parent to allow interaction.
 *   Supported fields per block type:
 *     hero:              title, subtitle, ctaLabel
 *     callToAction:      title, body, primaryLabel, secondaryLabel
 *     splitContentCards: headline
 *
 * BACKGROUND FOCAL POINT (Slice K)
 *   Focal point is stored in `config._layout.background.position: { x, y }`
 *   (added to SectionBackground type + sectionBackgroundSchema in Slice K).
 *   Flow:
 *     - On mount: read stored position from config (lazy useState initializer)
 *     - On drag: update local state only (backgroundPositionOverride for live preview)
 *     - On drag end / keyboard / reset: commit via onFieldChange("_layout", ...)
 *       which merges into inspectorDraft → persisted on next Save
 *     - On reload: SectionShell reads background.position from stored config
 *
 * BACKGROUND ZOOM (Slice K.1)
 *   Zoom is stored in `config._layout.background.zoom: number` (100–200).
 *   Flow mirrors the focal point pattern:
 *     - On mount: read stored zoom from config (lazy useState initializer)
 *     - On slider change: update local state (backgroundSizeOverride for live preview)
 *     - On slider release / reset: commit via onFieldChange("_layout", ...)
 *     - On reload: SectionShell reads background.zoom from stored config
 *   Reset clears both position and zoom from background (defaults: center + cover).
 *
 * MOBILE READINESS (Slice K.1)
 *   Architecture is prepared for future breakpoint-specific positioning:
 *     background.responsive.{desktop,tablet,mobile}.{position,zoom}
 *   For now, a single position and zoom applies across all breakpoints.
 *   The local state objects use `assetId` keying; future could add `breakpoint`.
 *
 * INTERACTIVITY
 *   The preview wrapper uses pointer-events-none so clicks on links/buttons
 *   inside the rendered block are intercepted by the canvas section's onClick
 *   handler (section selection) rather than triggering navigation.
 *   When `onFieldChange` is provided, the parent must remove pointer-events-none.
 */

import { useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import {
  Database,
  Blocks,
  Newspaper,
  Calendar,
  Users,
  CalendarDays,
  Award,
  HelpCircle,
} from "lucide-react";
import { getBlockDefinition } from "@/lib/homepage/block-registry";
import { FocalPointControl } from "./FocalPointControl";

// ---------------------------------------------------------------------------
// Lazy-loaded renderers (same pattern as PageBuilderClient / HomepagePreviewPanel)
// ---------------------------------------------------------------------------

const HeroRenderer = dynamic(
  () => import("@/components/website/blocks/HeroRenderer"),
  { ssr: false, loading: () => <RendererSkeleton /> },
);

const CallToActionRenderer = dynamic(
  () => import("@/components/website/blocks/CallToActionRenderer"),
  { ssr: false, loading: () => <RendererSkeleton /> },
);

const SplitContentCardsRenderer = dynamic(
  () => import("@/components/website/blocks/SplitContentCardsRenderer"),
  { ssr: false, loading: () => <RendererSkeleton /> },
);

// ---------------------------------------------------------------------------
// Skeleton shown while a renderer is loading
// ---------------------------------------------------------------------------

function RendererSkeleton() {
  return (
    <div className="w-full animate-pulse bg-[var(--surface-2)] py-10 px-6">
      <div className="mx-auto max-w-xl space-y-3">
        <div className="h-7 w-2/3 rounded bg-[var(--border)]" />
        <div className="h-4 w-full rounded bg-[var(--border)]" />
        <div className="h-4 w-4/5 rounded bg-[var(--border)]" />
        <div className="mt-4 h-9 w-28 rounded-lg bg-[var(--border)]" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data-driven block placeholder
// ---------------------------------------------------------------------------

const DATA_DRIVEN_ICONS: Record<string, React.ElementType> = {
  newsTeaser: Newspaper,
  eventsTeaser: Calendar,
  teamsTeaser: Users,
  weekplanTeaser: CalendarDays,
  sponsorsTeaser: Award,
};

function DataDrivenPlaceholder({ type }: { type: string }) {
  const def = getBlockDefinition(type);
  const Icon = DATA_DRIVEN_ICONS[type] ?? Database;
  return (
    <div className="flex items-center gap-4 bg-[var(--surface-2)] px-6 py-8 border-y border-dashed border-[var(--border)]">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200">
        <Icon className="h-5 w-5 text-emerald-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--foreground)]">
          {def?.displayName ?? type}
        </p>
        <p className="mt-0.5 text-[11px] text-[var(--muted)] leading-relaxed">
          Datengesteuert — Inhalte werden dynamisch aus der Datenbank geladen und
          auf der öffentlichen Website angezeigt.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coming-soon block placeholder
// ---------------------------------------------------------------------------

function ComingSoonPlaceholder({ type }: { type: string }) {
  const def = getBlockDefinition(type);
  return (
    <div className="flex items-center gap-4 bg-[var(--surface-2)] px-6 py-8 border-y border-dashed border-[var(--border)]">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 border border-amber-200">
        <Blocks className="h-5 w-5 text-amber-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--foreground)]">
          {def?.displayName ?? type}
        </p>
        <p className="mt-0.5 text-[11px] text-[var(--muted)] leading-relaxed">
          Dieser Block ist in Vorbereitung und wird in einem zukünftigen
          Release verfügbar sein.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Unknown block fallback
// ---------------------------------------------------------------------------

function UnknownBlockPlaceholder({ type }: { type: string }) {
  return (
    <div className="flex items-center gap-4 bg-[var(--surface-2)] px-6 py-6 border-y border-dashed border-[var(--border)]">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--border)]">
        <HelpCircle className="h-4 w-4 text-[var(--muted)]" />
      </div>
      <p className="text-xs text-[var(--muted)]">
        Unbekannter Blocktyp:{" "}
        <code className="font-mono text-[var(--text-2)]">{type}</code>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Background image URL resolution
// ---------------------------------------------------------------------------

type AssetUrlEntry = { assetId: string; url: string };

function useBackgroundImageUrl(config: Record<string, unknown>): string | null {
  const layout = config._layout as Record<string, unknown> | undefined;
  const background = layout?.background as Record<string, unknown> | undefined;
  const mediaAssetId =
    background?.type === "image" && typeof background.mediaAssetId === "string"
      ? background.mediaAssetId
      : null;

  const [resolved, setResolved] = useState<AssetUrlEntry | null>(null);

  useEffect(() => {
    if (!mediaAssetId) return;
    if (resolved?.assetId === mediaAssetId) return;

    const controller = new AbortController();
    fetch(`/api/media/${mediaAssetId}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<{ asset?: { url?: string } }>;
      })
      .then((data) => {
        if (data?.asset?.url) {
          setResolved({ assetId: mediaAssetId, url: data.asset.url });
        }
      })
      .catch(() => {
        // Fetch aborted or network error — keep existing value
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaAssetId]);

  if (!mediaAssetId || resolved?.assetId !== mediaAssetId) return null;
  return resolved.url;
}

// ---------------------------------------------------------------------------
// Focal-point helpers
// ---------------------------------------------------------------------------

/**
 * Read stored focal point from config._layout.background.position.
 * Returns a CSS background-position string, or null if not set.
 */
function readStoredFocalPoint(config: Record<string, unknown>): string | null {
  const layout = config._layout as Record<string, unknown> | undefined;
  const bg = layout?.background as Record<string, unknown> | undefined;
  if (bg?.type !== "image" || bg.position == null) return null;
  const pos = bg.position as { x?: unknown; y?: unknown };
  if (typeof pos.x === "number" && typeof pos.y === "number") {
    return `${Math.round(pos.x)}% ${Math.round(pos.y)}%`;
  }
  return null;
}

/**
 * Read stored zoom from config._layout.background.zoom.
 * Returns 100–200, default 100.
 */
function readStoredZoom(config: Record<string, unknown>): number {
  const layout = config._layout as Record<string, unknown> | undefined;
  const bg = layout?.background as Record<string, unknown> | undefined;
  if (bg?.type !== "image" || bg.zoom == null) return 100;
  const z = bg.zoom;
  if (typeof z === "number" && z >= 100 && z <= 200) return Math.round(z);
  return 100;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type CanvasBlockPreviewProps = {
  type: string;
  config: Record<string, unknown>;
  /**
   * Admin canvas only. When provided, supported text fields become
   * inline-editable and the background focal-point control is shown.
   * The parent (HomepageCanvasSection) must remove pointer-events-none
   * from the wrapper when this is set.
   *
   * Accepts `unknown` values because focal-point commits pass the full
   * `_layout` object (not just a string).
   */
  onFieldChange?: (field: string, value: unknown) => void;
};

// ---------------------------------------------------------------------------
// CanvasBlockPreview
// ---------------------------------------------------------------------------

export function CanvasBlockPreview({ type, config, onFieldChange }: CanvasBlockPreviewProps) {
  const backgroundImageUrl = useBackgroundImageUrl(config) ?? undefined;
  const def = getBlockDefinition(type);

  // ── Extract background metadata ────────────────────────────────────────
  const layout = config._layout as Record<string, unknown> | undefined;
  const background = layout?.background as Record<string, unknown> | undefined;
  const mediaAssetId =
    background?.type === "image" && typeof background.mediaAssetId === "string"
      ? background.mediaAssetId
      : null;

  // ── Focal-point local state ────────────────────────────────────────────
  // Initialised from stored config so a saved position is visible immediately.
  // Keyed by mediaAssetId: when the image changes, falls back to "50% 50%".
  const [focalPoint, setFocalPoint] = useState<{
    assetId: string | null;
    pos: string;
  }>(() => {
    const stored = readStoredFocalPoint(config);
    return { assetId: mediaAssetId, pos: stored ?? "50% 50%" };
  });

  // Derive effective background position: reset to center when assetId changes
  const backgroundPosition =
    focalPoint.assetId === mediaAssetId ? focalPoint.pos : "50% 50%";

  // ── Zoom local state ───────────────────────────────────────────────────
  // Keyed by mediaAssetId: when the image changes, zoom resets to 100 (cover).
  // Future: could also be keyed by breakpoint for responsive positioning.
  const [zoomState, setZoomState] = useState<{
    assetId: string | null;
    value: number;
  }>(() => ({ assetId: mediaAssetId, value: readStoredZoom(config) }));

  const activeZoom = zoomState.assetId === mediaAssetId ? zoomState.value : 100;

  // CSS background-size override for live slider preview
  const backgroundSizeOverride =
    activeZoom === 100 ? "cover" : `${activeZoom}%`;

  // Only show focal point control when inline editing is active AND there's a bg image
  const showFocalPoint = !!onFieldChange && !!backgroundImageUrl;

  // ── Focal-point handlers ───────────────────────────────────────────────

  function handleFocalPositionChange(pos: string) {
    setFocalPoint({ assetId: mediaAssetId, pos });
  }

  function handleFocalPositionCommit(pos: string) {
    if (!onFieldChange || !mediaAssetId) return;
    const parts = pos.split(" ");
    const x = Math.round(parseFloat(parts[0] ?? "50"));
    const y = Math.round(parseFloat(parts[1] ?? "50"));
    const currentLayout = (layout ?? {}) as Record<string, unknown>;
    const currentBackground = (background ?? {}) as Record<string, unknown>;
    onFieldChange("_layout", {
      ...currentLayout,
      background: { ...currentBackground, position: { x, y } },
    });
  }

  // ── Zoom handlers ──────────────────────────────────────────────────────

  function handleZoomChange(z: number) {
    setZoomState({ assetId: mediaAssetId, value: z });
  }

  function handleZoomCommit(z: number) {
    if (!onFieldChange || !mediaAssetId) return;
    const currentLayout = (layout ?? {}) as Record<string, unknown>;
    const currentBackground = (background ?? {}) as Record<string, unknown>;
    // Store 100 as absence (default) to keep config clean; >100 stored explicitly
    if (z === 100) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { zoom: _removed, ...backgroundWithoutZoom } = currentBackground;
      onFieldChange("_layout", {
        ...currentLayout,
        background: backgroundWithoutZoom,
      });
    } else {
      onFieldChange("_layout", {
        ...currentLayout,
        background: { ...currentBackground, zoom: z },
      });
    }
  }

  // ── Reset handler (position → center, zoom → 100) ──────────────────────

  function handleFocalReset() {
    setFocalPoint({ assetId: mediaAssetId, pos: "50% 50%" });
    setZoomState({ assetId: mediaAssetId, value: 100 });
    if (!onFieldChange || !mediaAssetId) return;
    const currentLayout = (layout ?? {}) as Record<string, unknown>;
    const currentBackground = (background ?? {}) as Record<string, unknown>;
    // Remove both position and zoom — SectionShell defaults: center + cover
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { position: _p, zoom: _z, ...backgroundDefaults } = currentBackground;
    onFieldChange("_layout", {
      ...currentLayout,
      background: backgroundDefaults,
    });
  }

  // ── Placeholder blocks (no inline editing) ────────────────────────────

  if (def?.datadriven) {
    return <DataDrivenPlaceholder type={type} />;
  }

  if (def?.status === "coming-next") {
    return <ComingSoonPlaceholder type={type} />;
  }

  // ── Rendered blocks ────────────────────────────────────────────────────

  // Cast onFieldChange to the renderer's narrower (string value) type. This is
  // safe because renderers only ever call onFieldChange with string values for
  // text fields. The _layout object commits are handled here in CanvasBlockPreview.
  const rendererFieldChange = onFieldChange as
    | ((field: string, value: string) => void)
    | undefined;

  const rendererNode = (() => {
    switch (type) {
      case "hero":
        return (
          <Suspense fallback={<RendererSkeleton />}>
            <HeroRenderer
              config={config}
              previewMode
              backgroundImageUrl={backgroundImageUrl}
              onFieldChange={rendererFieldChange}
              backgroundPositionOverride={showFocalPoint ? backgroundPosition : undefined}
              backgroundSizeOverride={showFocalPoint ? backgroundSizeOverride : undefined}
            />
          </Suspense>
        );

      case "callToAction":
        return (
          <Suspense fallback={<RendererSkeleton />}>
            <CallToActionRenderer
              config={config}
              previewMode
              backgroundImageUrl={backgroundImageUrl}
              onFieldChange={rendererFieldChange}
              backgroundPositionOverride={showFocalPoint ? backgroundPosition : undefined}
              backgroundSizeOverride={showFocalPoint ? backgroundSizeOverride : undefined}
            />
          </Suspense>
        );

      case "splitContentCards":
        return (
          <Suspense fallback={<RendererSkeleton />}>
            <SplitContentCardsRenderer
              config={config}
              previewMode
              backgroundImageUrl={backgroundImageUrl}
              onFieldChange={rendererFieldChange}
              backgroundPositionOverride={showFocalPoint ? backgroundPosition : undefined}
              backgroundSizeOverride={showFocalPoint ? backgroundSizeOverride : undefined}
            />
          </Suspense>
        );

      default:
        return <UnknownBlockPlaceholder type={type} />;
    }
  })();

  // When inline editing is not active, return the renderer directly.
  // The parent wrapper (HomepageCanvasSection) handles pointer-events-none.
  if (!onFieldChange) {
    return rendererNode;
  }

  // When inline editing is active, wrap in a relative container so we can
  // overlay FocalPointControl on top of the background image.
  return (
    <div className="relative">
      {rendererNode}
      {showFocalPoint && (
        <FocalPointControl
          position={backgroundPosition}
          zoom={activeZoom}
          onPositionChange={handleFocalPositionChange}
          onPositionCommit={handleFocalPositionCommit}
          onZoomChange={handleZoomChange}
          onZoomCommit={handleZoomCommit}
          onReset={handleFocalReset}
        />
      )}
    </div>
  );
}
