import Link from "next/link";
import Image from "next/image";
import type { PublicNewsArticleSummary } from "@/lib/news/public-news-feed";

type NewsGridBlockProps = {
  articles: PublicNewsArticleSummary[];
  tenantKey: string;
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function NewsCard({
  article,
  tenantKey,
}: {
  article: PublicNewsArticleSummary;
  tenantKey: string;
}) {
  const href = `/${tenantKey}/news/${article.slug}`;

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      {article.coverImageUrl ? (
        <div className="relative h-48 w-full overflow-hidden bg-neutral-100">
          <Image
            src={article.coverImageUrl}
            alt={article.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
      ) : (
        <div className="h-48 w-full bg-gradient-to-br from-neutral-100 to-neutral-200" />
      )}

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <time dateTime={article.publishedAt.toISOString()}>
            {formatDate(article.publishedAt)}
          </time>
          {article.authorName && (
            <>
              <span aria-hidden>·</span>
              <span>{article.authorName}</span>
            </>
          )}
        </div>

        <h3 className="text-base font-semibold leading-snug text-neutral-900 group-hover:text-blue-700 transition-colors">
          {article.title}
        </h3>

        {article.listingText && (
          <p className="line-clamp-3 text-sm leading-relaxed text-neutral-600">
            {article.listingText}
          </p>
        )}

        <span className="mt-auto text-sm font-medium text-blue-600 group-hover:underline">
          Weiterlesen →
        </span>
      </div>
    </Link>
  );
}

export function NewsGridBlock({ articles, tenantKey }: NewsGridBlockProps) {
  if (articles.length === 0) {
    return (
      <div className="py-16 text-center text-neutral-500">
        <p className="text-sm">Keine Artikel verfügbar.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <NewsCard key={article.id} article={article} tenantKey={tenantKey} />
      ))}
    </div>
  );
}
