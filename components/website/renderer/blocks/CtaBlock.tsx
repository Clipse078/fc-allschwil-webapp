import type { WebsiteTheme } from "@/lib/website/theme-engine";

type Props = {
  props: { heading?: string; body?: string; ctaLabel?: string; ctaHref?: string };
  theme: WebsiteTheme;
};

export default function CtaBlock({ props, theme }: Props) {
  const { heading, body, ctaLabel, ctaHref } = props;
  return (
    <section
      className="px-6 py-16 text-center lg:px-12"
      style={{ backgroundColor: theme.primary }}
    >
      {heading && (
        <h2 className="text-3xl font-bold text-white">{heading}</h2>
      )}
      {body && (
        <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">{body}</p>
      )}
      {ctaLabel && ctaHref && (
        <a
          href={ctaHref}
          className="mt-8 inline-block rounded-full px-8 py-3 text-sm font-semibold transition hover:opacity-90"
          style={{ backgroundColor: "white", color: theme.primary }}
        >
          {ctaLabel}
        </a>
      )}
    </section>
  );
}
