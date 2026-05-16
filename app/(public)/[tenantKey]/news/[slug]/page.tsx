import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicNewsArticle } from "@/lib/news/public-news-feed";

type ArticleDetailPageProps = {
  params: Promise<{
    tenantKey: string;
    slug: string;
  }>;
  searchParams: Promise<{
    locale?: string;
  }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: ArticleDetailPageProps): Promise<Metadata> {
  const { tenantKey, slug } = await params;
  const { locale = "de" } = await searchParams;

  const article = await getPublicNewsArticle(tenantKey, slug, locale);

  if (!article) {
    return { title: "Artikel nicht gefunden", robots: { index: false, follow: false } };
  }

  return {
    title: article.title,
    description: article.listingText ?? undefined,
    openGraph: article.coverImageUrl
      ? { images: [{ url: article.coverImageUrl }] }
      : undefined,
    robots: { index: true, follow: true },
  };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function ArticleDetailPage({
  params,
  searchParams,
}: ArticleDetailPageProps) {
  const { tenantKey, slug } = await params;
  const { locale = "de" } = await searchParams;

  const article = await getPublicNewsArticle(tenantKey, slug, locale);

  if (!article) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <nav className="mb-8">
        <Link
          href={`/${tenantKey}/news`}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ← Alle Neuigkeiten
        </Link>
      </nav>

      <article>
        {article.coverImageUrl && (
          <div className="relative mb-8 h-72 w-full overflow-hidden rounded-2xl bg-neutral-100 sm:h-96">
            <Image
              src={article.coverImageUrl}
              alt={article.title}
              fill
              priority
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>
        )}

        <header className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-500">
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

          <h1 className="text-3xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-4xl">
            {article.title}
          </h1>

          {article.listingText && (
            <p className="mt-4 text-lg leading-relaxed text-neutral-600">
              {article.listingText}
            </p>
          )}
        </header>

        {article.body && (
          <div className="prose prose-neutral max-w-none leading-relaxed text-neutral-800">
            {article.body.split("\n\n").map((paragraph, i) => (
              <p key={i} className="mb-4">
                {paragraph}
              </p>
            ))}
          </div>
        )}
      </article>
    </main>
  );
}
