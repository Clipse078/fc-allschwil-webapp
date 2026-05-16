import type { WebsiteTheme } from "@/lib/website/theme-engine";
import type { PublicNewsItem } from "@/lib/website/public-queries";

type Props = {
  props: { heading?: string; limit?: number };
  theme: WebsiteTheme;
  news: PublicNewsItem[];
};

function fmtDate(d: Date | null) {
  if (!d) return "";
  return new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "long", year: "numeric" }).format(d);
}

export default function NewsGridBlock({ props, theme, news }: Props) {
  const heading = props.heading ?? "News";

  return (
    <section className="px-6 py-14 lg:px-12">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-2xl font-bold tracking-tight" style={{ color: theme.text }}>
          {heading}
        </h2>

        {news.length === 0 ? (
          <p className="mt-6 text-sm" style={{ color: theme.textMuted }}>
            Noch keine News veröffentlicht.
          </p>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {news.map((article) => (
              <div
                key={article.id}
                className="overflow-hidden rounded-[18px]"
                style={{ border: `1px solid ${theme.border}`, backgroundColor: theme.cardBg }}
              >
                {article.coverImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={article.coverImageUrl}
                    alt={article.title}
                    className="h-44 w-full object-cover"
                  />
                )}
                <div className="p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: theme.textMuted }}>
                    {fmtDate(article.publishedAt)}
                  </p>
                  <p className="mt-1.5 text-base font-semibold leading-snug" style={{ color: theme.text }}>
                    {article.title}
                  </p>
                  {article.excerpt && (
                    <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed" style={{ color: theme.textMuted }}>
                      {article.excerpt}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
