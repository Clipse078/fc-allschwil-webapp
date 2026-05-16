import type { Metadata } from "next";
import { getPublicNewsList } from "@/lib/news/public-news-feed";
import { NewsGridBlock } from "@/components/public/news/NewsGridBlock";

type NewsListingPageProps = {
  params: Promise<{
    tenantKey: string;
  }>;
  searchParams: Promise<{
    locale?: string;
  }>;
};

export async function generateMetadata({
  params,
}: NewsListingPageProps): Promise<Metadata> {
  const { tenantKey } = await params;
  return {
    title: `Neuigkeiten – ${tenantKey}`,
    robots: { index: true, follow: true },
  };
}

export default async function NewsListingPage({
  params,
  searchParams,
}: NewsListingPageProps) {
  const { tenantKey } = await params;
  const { locale = "de" } = await searchParams;

  const articles = await getPublicNewsList(tenantKey, locale, 20);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Neuigkeiten
        </h1>
      </header>

      <NewsGridBlock articles={articles} tenantKey={tenantKey} />
    </main>
  );
}
