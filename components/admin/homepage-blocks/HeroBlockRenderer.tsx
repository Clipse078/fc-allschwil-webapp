"use client";

import type { HomepageBlockAdminItem } from "@/lib/homepage-blocks/admin-queries";

type HeroBlockRendererProps = {
  block: HomepageBlockAdminItem;
  tenantPrimaryColor?: string;
  tenantSecondaryColor?: string;
  /** Whether to show a draft/unpublished indicator badge. */
  showStatusBadge?: boolean;
};

const GRADIENT_CSS: Record<string, string> = {
  "top-bottom": "to bottom",
  "bottom-top": "to top",
  "left-right": "to right",
  "right-left": "to left",
  radial: "radial",
};

function resolveColor(
  value: string | null | undefined,
  primary: string,
  secondary: string,
): string {
  if (!value) return "transparent";
  if (value === "primary") return primary;
  if (value === "secondary") return secondary;
  if (value === "black") return "#000000";
  if (value === "white") return "#ffffff";
  return value;
}

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return "0,0,0";
  return `${r},${g},${b}`;
}

function buildOverlayStyle(
  overlayColor: string | null,
  overlayOpacity: number | null,
  primary: string,
  secondary: string,
): React.CSSProperties {
  if (!overlayColor || overlayOpacity === null || overlayOpacity === 0) return {};
  const resolvedColor = resolveColor(overlayColor, primary, secondary);
  const opacity = Math.min(100, Math.max(0, overlayOpacity)) / 100;
  const rgb = hexToRgb(resolvedColor);
  return {
    backgroundColor: `rgba(${rgb}, ${opacity})`,
  };
}

function buildGradientStyle(
  gradientType: string | null,
  gradientFrom: string | null,
  gradientTo: string | null,
  primary: string,
  secondary: string,
): React.CSSProperties {
  if (!gradientType || gradientType === "none") return {};

  const fromColor = resolveColor(gradientFrom, primary, secondary);
  const toColor = resolveColor(gradientTo, primary, secondary);

  if (gradientType === "radial") {
    return {
      background: `radial-gradient(circle at center, ${fromColor}, ${toColor})`,
    };
  }

  const direction = GRADIENT_CSS[gradientType];
  if (!direction) return {};

  return {
    background: `linear-gradient(${direction}, ${fromColor}, ${toColor})`,
  };
}

export default function HeroBlockRenderer({
  block,
  tenantPrimaryColor = "#0b4aa2",
  tenantSecondaryColor = "#c7332c",
  showStatusBadge = false,
}: HeroBlockRendererProps) {
  const data = (block.data ?? {}) as {
    headline?: string;
    subheadline?: string;
    ctaLabel?: string;
    ctaUrl?: string;
  };

  const textColor =
    block.textColor === "dark" ? "#111827" : block.textColor || "#ffffff";

  const overlayStyle = buildOverlayStyle(
    block.overlayColor,
    block.overlayOpacity,
    tenantPrimaryColor,
    tenantSecondaryColor,
  );

  const gradientStyle = buildGradientStyle(
    block.gradientType,
    block.gradientFrom,
    block.gradientTo,
    tenantPrimaryColor,
    tenantSecondaryColor,
  );

  const hasCta = data.ctaLabel && data.ctaUrl;

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-xl)] min-h-[320px] flex flex-col justify-end">
      {/* Background image */}
      {block.heroMedia ? (
        <img
          src={block.heroMedia.url}
          alt={block.heroMedia.altText ?? data.headline ?? "Hero"}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--surface-2)] to-[var(--border)]" />
      )}

      {/* Overlay color layer */}
      {overlayStyle.backgroundColor && (
        <div className="absolute inset-0" style={overlayStyle} />
      )}

      {/* Gradient layer */}
      {gradientStyle.background && (
        <div className="absolute inset-0" style={gradientStyle} />
      )}

      {/* Status badge (admin preview indicator) */}
      {showStatusBadge && block.status !== "PUBLISHED" && (
        <div className="absolute top-3 right-3 z-20">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow">
            {block.status === "DRAFT"
              ? "Entwurf"
              : block.status === "IN_REVIEW"
              ? "In Prüfung"
              : block.status === "SCHEDULED"
              ? "Geplant"
              : block.status}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 px-8 py-10 md:px-16 md:py-14">
        {data.headline && (
          <h1
            className="mb-3 text-3xl font-bold leading-tight md:text-5xl"
            style={{ color: textColor }}
          >
            {data.headline}
          </h1>
        )}
        {data.subheadline && (
          <p
            className="mb-6 max-w-2xl text-lg leading-relaxed opacity-90"
            style={{ color: textColor }}
          >
            {data.subheadline}
          </p>
        )}
        {hasCta && (
          <a
            href={data.ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold shadow-md transition hover:opacity-90"
            style={{
              backgroundColor: tenantPrimaryColor,
              color: "#ffffff",
            }}
          >
            {data.ctaLabel}
          </a>
        )}

        {/* Placeholder when no content */}
        {!data.headline && !data.subheadline && !hasCta && (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-white/60">
              Kein Inhalt konfiguriert. Titel, Untertitel und CTA im Formular hinzufügen.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
