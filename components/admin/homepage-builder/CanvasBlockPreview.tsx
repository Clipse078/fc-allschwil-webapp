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
 * BACKGROUND FOCAL POINT (Slice K — preview-only)
 *   Local `backgroundPosition` state is managed here. When the section has a
 *   background image and `onFieldChange` is active, `FocalPointControl` overlays
 *   the rendered block. Dragging repositions the image in the canvas preview.
 *   PERSISTENCE GAP: the focal point is NOT saved to the database (no schema
 *   field exists). It resets on page reload. See FocalPointControl.tsx.
 *
 * INTERACTIVITY
 *   The preview wrapper uses pointer-events-none so clicks on links/buttons
 *   inside the rendered block are intercepted by the canvas section's onClick
 *   handler (section selection) rather than triggering navigation.
 *   When `onFieldChange` is provided, the parent must remove pointer-events-none.
 */

import { useState, Suspense } from "react";
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
    // Already resolved for this asset — skip fetch
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

  // Return the URL only when it belongs to the current assetId
  if (!mediaAssetId || resolved?.assetId !== mediaAssetId) return null;
  return resolved.url;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type CanvasBlockPreviewProps = {
  type: string;
  config: Record<string, unknown>;
  /**
   * Admin canvas only. When provided, supported text fields become
   * inline-editable. The parent (HomepageCanvasSection) must remove
   * pointer-events-none from the wrapper when this is set.
   */
  onFieldChange?: (field: string, value: string) => void;
};

// ---------------------------------------------------------------------------
// CanvasBlockPreview
// ---------------------------------------------------------------------------

export function CanvasBlockPreview({ type, config, onFieldChange }: CanvasBlockPreviewProps) {
  const backgroundImageUrl = useBackgroundImageUrl(config) ?? undefined;
  const def = getBlockDefinition(type);

  // ── Focal-point local state (preview-only, not persisted) ──────────────
  // Tracks the position keyed by the current mediaAssetId so it auto-resets
  // when the background image changes — no effect needed.
  const [focalPoint, setFocalPoint] = useState<{
    assetId: string | null;
    pos: string;
  }>({ assetId: null, pos: "50% 50%" });

  const layout = config._layout as Record<string, unknown> | undefined;
  const background = layout?.background as Record<string, unknown> | undefined;
  const mediaAssetId =
    background?.type === "image" && typeof background.mediaAssetId === "string"
      ? background.mediaAssetId
      : null;

  // Derive effective background position: reset to center when assetId changes
  const backgroundPosition =
    focalPoint.assetId === mediaAssetId ? focalPoint.pos : "50% 50%";

  function handleFocalPositionChange(pos: string) {
    setFocalPoint({ assetId: mediaAssetId, pos });
  }

  function handleFocalReset() {
    setFocalPoint({ assetId: mediaAssetId, pos: "50% 50%" });
  }

  // Only show focal point control when inline editing is active AND there's a bg image
  const showFocalPoint = !!onFieldChange && !!backgroundImageUrl;

  // ── Placeholder blocks (no inline editing) ────────────────────────────

  // Data-driven blocks — show informational placeholder instead of trying to
  // render live data that is not available in the admin canvas context.
  if (def?.datadriven) {
    return <DataDrivenPlaceholder type={type} />;
  }

  // Coming-next blocks
  if (def?.status === "coming-next") {
    return <ComingSoonPlaceholder type={type} />;
  }

  // ── Rendered blocks ────────────────────────────────────────────────────

  const rendererNode = (() => {
    switch (type) {
      case "hero":
        return (
          <Suspense fallback={<RendererSkeleton />}>
            <HeroRenderer
              config={config}
              previewMode
              backgroundImageUrl={backgroundImageUrl}
              onFieldChange={onFieldChange}
              backgroundPositionOverride={showFocalPoint ? backgroundPosition : undefined}
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
              onFieldChange={onFieldChange}
              backgroundPositionOverride={showFocalPoint ? backgroundPosition : undefined}
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
              onFieldChange={onFieldChange}
              backgroundPositionOverride={showFocalPoint ? backgroundPosition : undefined}
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
          onPositionChange={handleFocalPositionChange}
          onReset={handleFocalReset}
        />
      )}
    </div>
  );
}
