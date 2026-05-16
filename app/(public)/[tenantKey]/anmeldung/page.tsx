import type { Metadata } from "next";
import Link from "next/link";
import { getPublicSiteData } from "@/lib/website/public-queries";
import { buildTheme } from "@/lib/website/theme-engine";
import { resolveRegistrationCTAs } from "@/lib/website/cta-system";

type AnmeldungPageProps = {
  params: Promise<{ tenantKey: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Anmeldung",
    robots: { index: true, follow: true },
  };
}

const SECTION_ICONS: Record<string, string> = {
  probetraining: "⚽",
  mitglied: "🤝",
  trainer: "📋",
  sponsor: "🏆",
};

export default async function AnmeldungPage({ params }: AnmeldungPageProps) {
  const { tenantKey } = await params;
  const site = await getPublicSiteData(tenantKey);
  const theme = buildTheme(site ?? { name: tenantKey });
  const ctas = resolveRegistrationCTAs(tenantKey);
  const siteName = site?.name ?? tenantKey;

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-12 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Mitmachen
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Jetzt durchstarten
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-neutral-600">
          Ob Spieler, Trainer, Freiwilliger oder Partner — bei {siteName} ist jeder
          willkommen. Wähle deinen Einstieg:
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        {ctas.map((cta) => (
          <section
            key={cta.key}
            id={cta.key}
            className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
                style={{ backgroundColor: `${theme.primaryColor}12` }}
              >
                {SECTION_ICONS[cta.key] ?? "✦"}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-neutral-900">{cta.label}</h2>
                <p className="mt-1 text-sm leading-relaxed text-neutral-500">
                  {cta.description}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-4">
              <p className="text-xs font-medium text-neutral-400">
                Anmeldeformular folgt in Kürze.
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                Melde dich in der Zwischenzeit per{" "}
                <Link
                  href={`/${tenantKey}/kontakt`}
                  className="font-semibold underline"
                  style={{ color: theme.primaryColor }}
                >
                  Kontaktseite
                </Link>
                .
              </p>
            </div>

            <Link
              href={`/${tenantKey}/kontakt`}
              className="inline-flex items-center gap-2 self-start rounded-full px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: theme.primaryColor }}
              data-cta={cta.analyticsEvent}
            >
              Jetzt kontaktieren
            </Link>
          </section>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-neutral-100 bg-neutral-50 p-6 text-center">
        <p className="text-sm font-semibold text-neutral-700">
          Hast du eine andere Frage?
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          Wir helfen dir gerne weiter.
        </p>
        <Link
          href={`/${tenantKey}/kontakt`}
          className="mt-4 inline-block rounded-full border border-neutral-300 px-6 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
        >
          Zur Kontaktseite
        </Link>
      </div>
    </main>
  );
}
