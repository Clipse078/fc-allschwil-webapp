import type { WebsiteTheme } from "@/lib/website/theme-engine";

type Props = {
  props: { heading?: string; limit?: number };
  theme: WebsiteTheme;
};

export default function NewsGridBlock({ props, theme }: Props) {
  return (
    <section className="px-6 py-14 lg:px-12">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-2xl font-bold" style={{ color: theme.text }}>
          {props.heading ?? "News"}
        </h2>
        <p className="mt-4 text-sm" style={{ color: theme.textMuted }}>
          News-Beiträge werden nach Konfiguration des News-Moduls hier angezeigt.
        </p>
      </div>
    </section>
  );
}
