import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { getWebsitePresetByKey } from "@/lib/website/website-preset-catalog";
import { resolveTheme } from "@/lib/website/theme-engine";
import {
  getPublicEventsList,
  getPublicNewsList,
  getPublicSponsorsList,
  getPublicTeamsList,
  getPublishedPageNav,
} from "@/lib/website/public-queries";
import WebsiteBlockRenderer from "@/components/website/renderer/WebsiteBlockRenderer";

// Reserved path prefixes that must not be handled by this route
const RESERVED_PREFIXES = [
  "dashboard", "vereinsleitung", "api", "login",
  "infoboard", "_next", "favicon", "public",
];

type Props = {
  params: Promise<{ tenantKey: string; slug?: string[] }>;
  searchParams?: Promise<{ locale?: string }>;
};

type BlockShape = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  sortOrder: number;
};

type SiteSettings = {
  websitePresetKey?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  footerText?: string | null;
  domain?: string | null;
};

function parseBlocks(raw: unknown): BlockShape[] {
  if (!Array.isArray(raw)) return [];
  return (raw as BlockShape[])
    .filter((b) => b?.type)
    .map((b, i) => ({
      id: b.id ?? `block-${i}`,
      type: b.type,
      props: typeof b.props === "object" && b.props !== null ? b.props : {},
      sortOrder: typeof b.sortOrder === "number" ? b.sortOrder : i,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

async function loadPage(tenantKey: string, slugSegments: string[], locale: string) {
  if (RESERVED_PREFIXES.includes(tenantKey)) return null;

  const slug = slugSegments.length > 0 ? slugSegments.join("/") : "home";

  // Try exact slug first
  let snapshot = await prisma.websitePublishSnapshot.findFirst({
    where: { tenantKey, slug, locale },
    orderBy: { publishedAt: "desc" },
  });

  // If slug is empty/home, also try the HOMEPAGE page type
  if (!snapshot && (slug === "home" || slug === "")) {
    snapshot = await prisma.websitePublishSnapshot.findFirst({
      where: { tenantKey, locale, pageType: "HOMEPAGE" },
      orderBy: { publishedAt: "desc" },
    });
  }

  // Fallback: first published page for this tenant
  if (!snapshot) {
    snapshot = await prisma.websitePublishSnapshot.findFirst({
      where: { tenantKey },
      orderBy: { publishedAt: "desc" },
    });
  }

  return snapshot;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { tenantKey, slug: slugSegments = [] } = await params;
  const { locale = "de" } = (await searchParams) ?? {};
  const snapshot = await loadPage(tenantKey, slugSegments, locale);

  return {
    title: snapshot?.metaTitle ?? snapshot?.title ?? tenantKey,
    description: snapshot?.metaDescription ?? undefined,
  };
}

export default async function TenantWebsitePage({ params, searchParams }: Props) {
  const { tenantKey, slug: slugSegments = [] } = await params;
  const { locale = "de" } = (await searchParams) ?? {};

  // Guard reserved routes
  if (RESERVED_PREFIXES.includes(tenantKey)) notFound();

  const snapshot = await loadPage(tenantKey, slugSegments, locale);
  if (!snapshot) notFound();

  // Load site settings for branding
  const site = await prisma.websiteSite.findUnique({
    where: { tenantKey },
    select: { name: true, settingsJson: true },
  });

  const sj = (site?.settingsJson ?? {}) as SiteSettings;
  const preset = sj.websitePresetKey ? getWebsitePresetByKey(sj.websitePresetKey) : null;
  const theme = resolveTheme({
    preset,
    primaryColor: sj.primaryColor,
    logoUrl: sj.logoUrl,
    siteName: site?.name,
    domain: sj.domain,
  });

  const blocks = parseBlocks(snapshot.blocksJson);

  // Fetch live data for data-driven blocks
  const [events, teams, news, sponsors, navPages] = await Promise.all([
    getPublicEventsList(tenantKey, 10),
    getPublicTeamsList(tenantKey, 12),
    getPublicNewsList(tenantKey, snapshot.locale ?? "de", 6),
    getPublicSponsorsList(tenantKey),
    getPublishedPageNav(tenantKey),
  ]);

  const siteName = site?.name ?? tenantKey;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", backgroundColor: theme.bg, color: theme.text, minHeight: "100vh" }}>
      {/* Site header */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between gap-6 px-6 py-4 shadow-sm"
        style={{ backgroundColor: theme.bg, borderBottom: `1px solid ${theme.border}` }}
      >
        <a href={`/${tenantKey}`} className="flex items-center gap-3">
          {sj.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sj.logoUrl} alt={siteName} className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: theme.primary }}
            >
              {siteName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="text-base font-semibold" style={{ color: theme.text }}>
            {siteName}
          </span>
        </a>

        {navPages.length > 1 && (
          <nav className="hidden items-center gap-1 md:flex">
            {navPages.slice(0, 6).map((p) => (
              <a
                key={`${p.slug}:${p.locale}`}
                href={`/${tenantKey}/${p.slug}`}
                className="rounded-full px-3 py-1.5 text-sm font-medium transition hover:opacity-80"
                style={{ color: theme.textMuted }}
              >
                {p.title}
              </a>
            ))}
          </nav>
        )}
      </header>

      {/* Page content */}
      <main>
        {blocks.length > 0 ? (
          <WebsiteBlockRenderer
            blocks={blocks}
            theme={theme}
            events={events}
            teams={teams}
            news={news}
            sponsors={sponsors}
          />
        ) : (
          <div className="flex min-h-[400px] items-center justify-center px-6 text-center">
            <div>
              <p className="text-2xl font-bold" style={{ color: theme.text }}>
                {snapshot.title}
              </p>
              <p className="mt-2 text-sm" style={{ color: theme.textMuted }}>
                Diese Seite hat noch keine Inhaltsblöcke.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Site footer */}
      <footer
        className="mt-16 px-6 py-8 text-center text-sm"
        style={{ backgroundColor: theme.accent, color: theme.textMuted, borderTop: `1px solid ${theme.border}` }}
      >
        {sj.footerText ?? `© ${new Date().getFullYear()} ${siteName}`}
      </footer>
    </div>
  );
}
