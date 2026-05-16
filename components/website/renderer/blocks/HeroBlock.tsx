import type { WebsiteTheme } from "@/lib/website/theme-engine";

type Props = {
  props: {
    title?: string;
    subtitle?: string;
    eyebrow?: string;
    ctaLabel?: string;
    ctaHref?: string;
    backgroundImage?: string | null;
  };
  theme: WebsiteTheme;
};

export default function HeroBlock({ props, theme }: Props) {
  const { title, subtitle, eyebrow, ctaLabel, ctaHref, backgroundImage } = props;

  return (
    <section
      className="relative flex min-h-[420px] items-center overflow-hidden px-6 py-20 lg:px-12 lg:py-28"
      style={{
        backgroundColor: theme.primary,
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {backgroundImage && (
        <div className="absolute inset-0" style={{ backgroundColor: `${theme.primary}cc` }} />
      )}
      <div className="relative z-10 mx-auto max-w-4xl text-white">
        {eyebrow && (
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest opacity-80">
            {eyebrow}
          </p>
        )}
        {title && (
          <h1 className="text-4xl font-bold leading-tight tracking-tight lg:text-6xl">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="mt-5 max-w-2xl text-lg leading-relaxed opacity-90 lg:text-xl">
            {subtitle}
          </p>
        )}
        {ctaLabel && ctaHref && (
          <a
            href={ctaHref}
            className="mt-8 inline-block rounded-full px-7 py-3 text-sm font-semibold transition hover:opacity-90"
            style={{ backgroundColor: "white", color: theme.primary }}
          >
            {ctaLabel}
          </a>
        )}
      </div>
    </section>
  );
}
