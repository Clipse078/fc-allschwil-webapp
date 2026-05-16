import type { Metadata } from "next";
import Image from "next/image";
import { getPublicSponsors } from "@/lib/website/public-queries";
import type { PublicSponsor } from "@/lib/website/public-queries";

type SponsorsPageProps = {
  params: Promise<{ tenantKey: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Sponsoren",
    robots: { index: true, follow: true },
  };
}

function groupByTier(sponsors: PublicSponsor[]): Map<string, PublicSponsor[]> {
  const map = new Map<string, PublicSponsor[]>();
  for (const sponsor of sponsors) {
    const key = sponsor.tier?.trim() || "Partner";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(sponsor);
  }
  return map;
}

function SponsorCard({ sponsor }: { sponsor: PublicSponsor }) {
  const inner = (
    <div className="group flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:shadow-md">
      {sponsor.logoUrl ? (
        <div className="relative h-16 w-full">
          <Image
            src={sponsor.logoUrl}
            alt={sponsor.name}
            fill
            className="object-contain"
            sizes="(max-width: 640px) 50vw, 200px"
          />
        </div>
      ) : (
        <div className="flex h-16 w-full items-center justify-center rounded-xl bg-neutral-50">
          <span className="text-sm font-semibold text-neutral-500">
            {sponsor.name}
          </span>
        </div>
      )}
      <p className="text-center text-sm font-medium text-neutral-700 group-hover:text-neutral-900">
        {sponsor.name}
      </p>
    </div>
  );

  if (sponsor.websiteUrl) {
    return (
      <a
        href={sponsor.websiteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
        aria-label={`${sponsor.name} – Website besuchen`}
      >
        {inner}
      </a>
    );
  }
  return <div>{inner}</div>;
}

export default async function SponsorsPage({ params }: SponsorsPageProps) {
  const { tenantKey } = await params;
  const sponsors = await getPublicSponsors(tenantKey);
  const grouped = groupByTier(sponsors);
  const hasGroups = grouped.size > 1;

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Sponsoren
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Unsere Partner
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600">
          Unsere Partner unterstützen den Vereinsalltag auf und neben dem Platz.
        </p>
      </header>

      {sponsors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 py-20 text-center">
          <p className="text-sm font-medium text-neutral-400">
            Noch keine Sponsoren hinterlegt.
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          {Array.from(grouped.entries()).map(([tier, tierSponsors]) => (
            <section key={tier}>
              {hasGroups && (
                <h2 className="mb-6 text-xs font-semibold uppercase tracking-widest text-neutral-400">
                  {tier}
                </h2>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {tierSponsors.map((sponsor) => (
                  <SponsorCard key={sponsor.id} sponsor={sponsor} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
