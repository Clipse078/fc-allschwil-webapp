import type { WebsiteTheme } from "@/lib/website/theme-engine";
import type { PublicSponsorItem } from "@/lib/website/public-queries";

type Props = {
  props: { heading?: string };
  theme: WebsiteTheme;
  sponsors: PublicSponsorItem[];
};

export default function SponsorStripBlock({ props, theme, sponsors }: Props) {
  return (
    <section className="px-6 py-10 lg:px-12" style={{ backgroundColor: theme.accent }}>
      {props.heading && (
        <p
          className="mb-5 text-center text-xs font-semibold uppercase tracking-widest"
          style={{ color: theme.textMuted }}
        >
          {props.heading}
        </p>
      )}

      {sponsors.length > 0 ? (
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-8">
          {sponsors.map((s) =>
            s.logoUrl ? (
              s.websiteUrl ? (
                <a key={s.id} href={s.websiteUrl} target="_blank" rel="noopener noreferrer" title={s.name}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.logoUrl} alt={s.name} className="h-10 max-w-[120px] object-contain opacity-70 transition hover:opacity-100" />
                </a>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={s.id} src={s.logoUrl} alt={s.name} className="h-10 max-w-[120px] object-contain opacity-70" />
              )
            ) : (
              <span
                key={s.id}
                className="rounded-[10px] px-4 py-2 text-sm font-semibold"
                style={{ backgroundColor: theme.cardBg, color: theme.textMuted, border: `1px solid ${theme.border}` }}
              >
                {s.name}
              </span>
            ),
          )}
        </div>
      ) : (
        <p className="text-center text-sm" style={{ color: theme.textMuted }}>
          Sponsoren werden nach Konfiguration eingeblendet.
        </p>
      )}
    </section>
  );
}
