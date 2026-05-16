import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { buildHomepageData } from "@/lib/website/homepage-builder";
import { CATEGORY_LABELS } from "@/lib/website/team-queries";
import type {
  HeroBlock,
  NewsBlock,
  EventsBlock,
  TeamsBlock,
  SponsorsBlock,
} from "@/lib/website/homepage-builder";

type HomePageProps = {
  params: Promise<{ tenantKey: string }>;
};

export async function generateMetadata({
  params,
}: HomePageProps): Promise<Metadata> {
  const { tenantKey } = await params;
  const { site } = await buildHomepageData(tenantKey);
  return {
    title: site?.name ?? tenantKey,
    description: site?.tagline ?? undefined,
  };
}

const TYPE_BADGE: Record<string, string> = {
  MATCH: "bg-blue-100 text-blue-700",
  TOURNAMENT: "bg-orange-100 text-orange-700",
  TRAINING: "bg-emerald-100 text-emerald-700",
  OTHER: "bg-neutral-100 text-neutral-600",
  VACATION_PERIOD: "bg-amber-100 text-amber-700",
};

const TYPE_LABELS: Record<string, string> = {
  MATCH: "Spiel",
  TOURNAMENT: "Turnier",
  TRAINING: "Training",
  OTHER: "Anlass",
  VACATION_PERIOD: "Ferienperiode",
};

const CATEGORY_ACCENT: Record<string, string> = {
  AKTIVE: "bg-blue-50 text-blue-700",
  FRAUEN: "bg-rose-50 text-rose-700",
  JUNIOREN: "bg-violet-50 text-violet-700",
  KINDERFUSSBALL: "bg-amber-50 text-amber-700",
  SENIOREN: "bg-slate-100 text-slate-600",
  TRAININGSGRUPPE: "bg-teal-50 text-teal-700",
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("de-CH", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
}

function HeroSection({
  block,
  tenantKey,
}: {
  block: HeroBlock;
  tenantKey: string;
}) {
  return (
    <section
      className="relative overflow-hidden py-24 sm:py-32"
      style={{ backgroundColor: block.primaryColor }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage: `radial-gradient(circle at 70% 50%, white 0%, transparent 60%)`,
        }}
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start gap-6 sm:gap-8">
          {block.logoUrl && (
            <div className="relative h-16 w-16 sm:h-20 sm:w-20">
              <Image
                src={block.logoUrl}
                alt={block.name}
                fill
                className="object-contain"
                sizes="80px"
                priority
              />
            </div>
          )}
          <div>
            <h1 className="font-[var(--font-display)] text-5xl font-bold uppercase leading-none tracking-tight text-white sm:text-7xl">
              {block.name}
            </h1>
            {block.tagline && (
              <p className="mt-4 text-lg text-white/80 sm:text-xl">
                {block.tagline}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/${tenantKey}/news`}
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold transition hover:bg-white/90"
              style={{ color: block.primaryColor }}
            >
              Neuigkeiten
            </Link>
            <Link
              href={`/${tenantKey}/teams`}
              className="rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Unsere Teams
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function NewsSection({
  block,
  tenantKey,
}: {
  block: NewsBlock;
  tenantKey: string;
}) {
  return (
    <section className="bg-neutral-50 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Aktuell
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
              Neuigkeiten
            </h2>
          </div>
          <Link
            href={`/${tenantKey}/news`}
            className="shrink-0 text-sm font-medium text-blue-600 hover:underline"
          >
            Alle →
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {block.articles.map((article) => (
            <Link
              key={article.id}
              href={`/${tenantKey}/news/${article.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md"
            >
              {article.coverImageUrl ? (
                <div className="relative h-44 w-full overflow-hidden bg-neutral-100">
                  <Image
                    src={article.coverImageUrl}
                    alt={article.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>
              ) : (
                <div className="h-44 w-full bg-gradient-to-br from-neutral-100 to-neutral-200" />
              )}
              <div className="flex flex-1 flex-col gap-2 p-4">
                <p className="text-xs text-neutral-400">
                  {formatDate(article.publishedAt)}
                </p>
                <h3 className="text-sm font-semibold leading-snug text-neutral-900 group-hover:text-blue-700 transition-colors">
                  {article.title}
                </h3>
                {article.listingText && (
                  <p className="line-clamp-2 text-xs leading-relaxed text-neutral-500">
                    {article.listingText}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function EventsSection({
  block,
  tenantKey,
}: {
  block: EventsBlock;
  tenantKey: string;
}) {
  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Kalender
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
              Nächste Termine
            </h2>
          </div>
          <Link
            href={`/${tenantKey}/events`}
            className="shrink-0 text-sm font-medium text-blue-600 hover:underline"
          >
            Alle →
          </Link>
        </div>
        <div className="space-y-2">
          {block.events.map((event) => {
            const badgeCls = TYPE_BADGE[event.type] ?? TYPE_BADGE.OTHER;
            return (
              <div
                key={event.id}
                className="flex items-start gap-3 rounded-2xl border border-neutral-100 bg-neutral-50 px-5 py-3.5"
              >
                <div className="w-20 shrink-0">
                  <p className="text-xs font-semibold text-neutral-500">
                    {formatDate(event.startAt)}
                  </p>
                  <p className="text-xs text-neutral-400">
                    {formatTime(event.startAt)}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeCls}`}>
                      {TYPE_LABELS[event.type] ?? event.type}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-medium text-neutral-900">
                    {event.title}
                  </p>
                  {event.opponentName && (
                    <p className="text-xs text-neutral-500">vs. {event.opponentName}</p>
                  )}
                </div>
                {event.location && (
                  <p className="hidden shrink-0 text-xs text-neutral-400 sm:block">
                    {event.location}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TeamsSection({
  block,
  tenantKey,
}: {
  block: TeamsBlock;
  tenantKey: string;
}) {
  return (
    <section className="bg-neutral-50 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Verein
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
              Unsere Teams
            </h2>
          </div>
          <Link
            href={`/${tenantKey}/teams`}
            className="shrink-0 text-sm font-medium text-blue-600 hover:underline"
          >
            Alle →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {block.teams.map((team) => {
            const accentCls =
              CATEGORY_ACCENT[team.category] ?? CATEGORY_ACCENT.AKTIVE;
            return (
              <Link
                key={team.id}
                href={`/${tenantKey}/teams/${team.slug}`}
                className="group flex flex-col items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-4 text-center shadow-sm transition hover:shadow-md"
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full ${accentCls} font-[var(--font-display)] text-sm font-bold uppercase`}
                >
                  {(team.ageGroup ?? team.name).slice(0, 3)}
                </div>
                <p className="text-xs font-semibold leading-snug text-neutral-800 group-hover:text-blue-700 transition-colors">
                  {team.displayName ?? team.name}
                </p>
                <p className="text-[10px] text-neutral-400">
                  {CATEGORY_LABELS[team.category] ?? team.category}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SponsorsSection({ block }: { block: SponsorsBlock }) {
  return (
    <section className="border-t border-neutral-200 bg-white py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <p className="mb-8 text-center text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Unsere Partner
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8">
          {block.sponsors.map((sponsor) => {
            const inner = sponsor.logoUrl ? (
              <div className="relative h-10 w-28 grayscale transition hover:grayscale-0">
                <Image
                  src={sponsor.logoUrl}
                  alt={sponsor.name}
                  fill
                  className="object-contain"
                  sizes="112px"
                />
              </div>
            ) : (
              <span className="text-sm font-semibold text-neutral-400 transition hover:text-neutral-700">
                {sponsor.name}
              </span>
            );
            return sponsor.websiteUrl ? (
              <a
                key={sponsor.id}
                href={sponsor.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {inner}
              </a>
            ) : (
              <div key={sponsor.id}>{inner}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default async function HomePage({ params }: HomePageProps) {
  const { tenantKey } = await params;
  const homepage = await buildHomepageData(tenantKey);

  return (
    <>
      {homepage.blocks.map((block, i) => {
        switch (block.type) {
          case "hero":
            return <HeroSection key={i} block={block} tenantKey={tenantKey} />;
          case "news":
            return <NewsSection key={i} block={block} tenantKey={tenantKey} />;
          case "events":
            return <EventsSection key={i} block={block} tenantKey={tenantKey} />;
          case "teams":
            return <TeamsSection key={i} block={block} tenantKey={tenantKey} />;
          case "sponsors":
            return <SponsorsSection key={i} block={block} />;
          default:
            return null;
        }
      })}
    </>
  );
}
