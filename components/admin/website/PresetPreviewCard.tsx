import type { WebsitePreset } from "@/lib/website/website-preset-catalog";

type Props = {
  preset: WebsitePreset;
  compact?: boolean;
};

const BLOCK_H: Record<string, string> = {
  "fullscreen-hero": "h-14",
  "full-width-hero": "h-14",
  "rotating-hero": "h-14",
  hero: "h-10",
  "full-width-image": "h-10",
  "stats-row": "h-4",
  "sponsors-bar": "h-4",
  "news-feed": "h-8",
  "event-list": "h-8",
  "team-grid": "h-10",
  "intro-text": "h-5",
  "rich-text": "h-6",
  "registration-cta": "h-6",
  "contact-info": "h-5",
  divider: "h-2",
};

function blockHeight(name: string): string {
  return BLOCK_H[name.trim().toLowerCase()] ?? "h-6";
}

function parseRhythm(rhythm: string): string[] {
  return rhythm
    .split("→")
    .map((s) => s.trim().replace(/^(header|logo-bar|date-header|tournament-header)\s*→?\s*/i, ""))
    .filter(Boolean);
}

export default function PresetPreviewCard({ preset, compact = false }: Props) {
  const primary = preset.previewTokens?.primary ?? "#0b4aa2";
  const accent = preset.previewTokens?.accent ?? "#f1f5f9";
  const blocks = parseRhythm(preset.homepageRhythm);

  return (
    <div
      className={`rounded-[16px] border border-slate-200/80 bg-white p-3 ${compact ? "" : "shadow-[0_4px_12px_rgba(15,23,42,0.04)]"}`}
    >
      {/* Mini wireframe */}
      <div
        className="overflow-hidden rounded-[10px] p-2 space-y-1"
        style={{ backgroundColor: accent }}
      >
        {/* Top bar */}
        <div
          className="h-3 w-full rounded"
          style={{ backgroundColor: primary, opacity: 0.9 }}
        />
        {/* Blocks */}
        {blocks.slice(0, compact ? 4 : 6).map((block, i) => {
          const h = blockHeight(block);
          const isFill = i === 0 || block.includes("hero") || block.includes("full-width");
          return (
            <div
              key={i}
              className={`w-full rounded ${h}`}
              style={{
                backgroundColor: isFill ? primary : "#cbd5e1",
                opacity: isFill ? 0.75 : 0.45,
              }}
            />
          );
        })}
      </div>

      {/* Label */}
      {!compact && (
        <div className="mt-2.5">
          <p className="text-[12px] font-semibold text-slate-900">{preset.name}</p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
            {preset.visualTone}
          </p>
        </div>
      )}
    </div>
  );
}
