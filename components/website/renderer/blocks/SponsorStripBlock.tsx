import type { WebsiteTheme } from "@/lib/website/theme-engine";

type Logo = { name: string; imageSrc: string; href?: string };

type Props = {
  props: { heading?: string; logos?: Logo[] };
  theme: WebsiteTheme;
};

export default function SponsorStripBlock({ props, theme }: Props) {
  const logos = Array.isArray(props.logos) ? props.logos as Logo[] : [];
  return (
    <section className="px-6 py-10 lg:px-12" style={{ backgroundColor: theme.accent }}>
      {props.heading && (
        <p className="mb-5 text-center text-xs font-semibold uppercase tracking-widest" style={{ color: theme.textMuted }}>
          {props.heading}
        </p>
      )}
      {logos.length > 0 ? (
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-8">
          {logos.map((logo, i) =>
            logo.href ? (
              <a key={i} href={logo.href} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo.imageSrc} alt={logo.name} className="h-10 object-contain opacity-75 transition hover:opacity-100" />
              </a>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={logo.imageSrc} alt={logo.name} className="h-10 object-contain opacity-75" />
            ),
          )}
        </div>
      ) : (
        <p className="text-center text-sm" style={{ color: theme.textMuted }}>
          Sponsoren-Logos werden nach Konfiguration eingeblendet.
        </p>
      )}
    </section>
  );
}
