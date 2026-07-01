"use client";

/**
 * components/admin/homepage-builder/canvas-renderers/CanvasSplitContentCardsRenderer.tsx
 *
 * Admin-only canvas preview for the `splitContentCards` section type.
 *
 * Renders a lightweight representative layout showing:
 *   - eyebrow / headline
 *   - card titles, descriptions, and CTA text
 *   - card count and variant color indicators
 *
 * Does not duplicate full public renderer logic.
 * ADMIN-ONLY. Does not affect public website output.
 */

import type { SplitContentCardsSectionConfig } from "@/lib/homepage/section-types";
import { resolveLayout, THEME_TOKENS } from "@/lib/cms/layout-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  config: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Card variant colours
// ---------------------------------------------------------------------------

const CARD_VARIANT_STYLES: Record<string, { border: string; dot: string }> = {
  orange:  { border: "border-orange-300",  dot: "bg-orange-400"  },
  blue:    { border: "border-blue-300",    dot: "bg-blue-400"    },
  red:     { border: "border-red-300",     dot: "bg-red-400"     },
  neutral: { border: "border-gray-300",    dot: "bg-gray-400"    },
};

// ---------------------------------------------------------------------------
// CanvasSplitContentCardsRenderer
// ---------------------------------------------------------------------------

export function CanvasSplitContentCardsRenderer({ config }: Props) {
  const scc = config as SplitContentCardsSectionConfig;
  const layout = resolveLayout(scc._layout);
  const tokens = THEME_TOKENS[layout.theme];

  const cards = Array.isArray(scc.cards) ? scc.cards.slice(0, 4) : [];
  const headline = (scc.headline as string | undefined) || (scc.eyebrow as string | undefined);

  return (
    <div className={`min-h-[140px] px-5 py-6 ${tokens.bg}`}>
      {/* Headline */}
      <div className="mb-3">
        {(scc.eyebrow as string | undefined) && (
          <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${tokens.eyebrow}`}>
            {scc.eyebrow as string}
          </p>
        )}
        <h3 className={`text-base font-bold leading-tight truncate ${tokens.text}`}>
          {headline || <span className="opacity-40">Überschrift…</span>}
        </h3>
      </div>

      {/* Cards grid */}
      {cards.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {cards.map((card, i) => {
            const vs = CARD_VARIANT_STYLES[card.variant] ?? CARD_VARIANT_STYLES.neutral;
            return (
              <div
                key={card.id ?? i}
                className={`flex-1 min-w-[80px] max-w-[140px] rounded-lg border px-2.5 py-2 bg-white/50 ${vs.border}`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${vs.dot}`} />
                  <p className={`text-[11px] font-semibold leading-tight truncate ${tokens.text}`}>
                    {card.title || "Karte"}
                  </p>
                </div>
                {card.body && (
                  <p className={`text-[10px] leading-relaxed line-clamp-2 ${tokens.subtext}`}>
                    {card.body}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`text-xs ${tokens.subtext} opacity-50 italic`}>
          Keine Karten konfiguriert
        </div>
      )}
    </div>
  );
}
