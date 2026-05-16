import type { WebsiteTheme } from "@/lib/website/theme-engine";

type Feature = { title: string; description: string; icon?: string };

type Props = {
  props: { heading?: string; features?: Feature[] };
  theme: WebsiteTheme;
};

export default function FeatureGridBlock({ props, theme }: Props) {
  const features = Array.isArray(props.features) ? props.features as Feature[] : [];
  return (
    <section className="px-6 py-14 lg:px-12">
      <div className="mx-auto max-w-5xl">
        {props.heading && (
          <h2 className="mb-8 text-2xl font-bold" style={{ color: theme.text }}>
            {props.heading}
          </h2>
        )}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <div
              key={i}
              className="rounded-[16px] p-5"
              style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}` }}
            >
              {f.icon && <p className="mb-3 text-2xl">{f.icon}</p>}
              <p className="font-semibold" style={{ color: theme.text }}>{f.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: theme.textMuted }}>{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
