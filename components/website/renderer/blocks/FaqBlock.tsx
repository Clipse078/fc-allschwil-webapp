import type { WebsiteTheme } from "@/lib/website/theme-engine";

type FaqItem = { question: string; answer: string };

type Props = {
  props: { heading?: string; items?: FaqItem[] };
  theme: WebsiteTheme;
};

export default function FaqBlock({ props, theme }: Props) {
  const items = Array.isArray(props.items) ? props.items as FaqItem[] : [];
  return (
    <section className="px-6 py-14 lg:px-12">
      <div className="mx-auto max-w-3xl">
        {props.heading && (
          <h2 className="mb-8 text-2xl font-bold" style={{ color: theme.text }}>
            {props.heading}
          </h2>
        )}
        <div className="space-y-4">
          {items.map((item, i) => (
            <div
              key={i}
              className="rounded-[14px] p-5"
              style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}` }}
            >
              <p className="font-semibold" style={{ color: theme.text }}>{item.question}</p>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: theme.textMuted }}>{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
