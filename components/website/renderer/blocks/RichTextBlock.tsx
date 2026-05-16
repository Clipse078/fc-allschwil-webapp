import type { WebsiteTheme } from "@/lib/website/theme-engine";

type Props = {
  props: { html?: string; heading?: string; body?: string };
  theme: WebsiteTheme;
};

export default function RichTextBlock({ props, theme }: Props) {
  const { html, heading, body } = props;

  return (
    <section className="mx-auto max-w-3xl px-6 py-14 lg:px-8">
      {heading && (
        <h2 className="text-3xl font-bold tracking-tight" style={{ color: theme.text }}>
          {heading}
        </h2>
      )}
      {html ? (
        <div
          className="prose prose-slate mt-6 max-w-none"
          style={{ color: theme.text }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : body ? (
        <p className="mt-6 text-lg leading-relaxed" style={{ color: theme.textMuted }}>
          {body}
        </p>
      ) : null}
    </section>
  );
}
