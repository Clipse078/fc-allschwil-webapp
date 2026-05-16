import type { Metadata } from "next";
import { Mail, MapPin, Clock, Phone, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getPublicSiteData } from "@/lib/website/public-queries";
import { buildTheme } from "@/lib/website/theme-engine";
import InlineCTA from "@/components/public/cta/InlineCTA";

type KontaktPageProps = {
  params: Promise<{ tenantKey: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Kontakt",
    robots: { index: true, follow: true },
  };
}

type ContactCard = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
  placeholder?: boolean;
};

export default async function KontaktPage({ params }: KontaktPageProps) {
  const { tenantKey } = await params;
  const site = await getPublicSiteData(tenantKey);
  const theme = buildTheme(site ?? { name: tenantKey });

  const siteName = site?.name ?? tenantKey;

  const contactCards: ContactCard[] = [
    {
      icon: Mail,
      label: "E-Mail",
      value: "info@" + tenantKey.toLowerCase().replace(/[^a-z0-9]/g, "") + ".ch",
      href: "mailto:info@" + tenantKey.toLowerCase().replace(/[^a-z0-9]/g, "") + ".ch",
      placeholder: true,
    },
    {
      icon: MapPin,
      label: "Standort",
      value: "Adresse wird in Kürze hinterlegt.",
      placeholder: true,
    },
    {
      icon: Phone,
      label: "Telefon",
      value: "Telefonnummer folgt.",
      placeholder: true,
    },
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Kontakt
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Nimm Kontakt auf
        </h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-neutral-600">
          Wir freuen uns von dir zu hören — ob Fragen zum Verein, zur Mitgliedschaft
          oder zum Probetraining. Schreib uns einfach.
        </p>
      </header>

      <div className="space-y-10">
        <section>
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-widest text-neutral-400">
            Allgemeiner Kontakt
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {contactCards.map((card) => {
              const Icon = card.icon;
              const inner = (
                <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: `${theme.primaryColor}15`,
                      color: theme.primaryColor,
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      {card.label}
                    </p>
                    <p
                      className={`mt-1 text-sm font-medium ${
                        card.placeholder ? "text-neutral-400 italic" : "text-neutral-900"
                      }`}
                    >
                      {card.value}
                    </p>
                  </div>
                </div>
              );

              return card.href && !card.placeholder ? (
                <a key={card.label} href={card.href}>
                  {inner}
                </a>
              ) : (
                <div key={card.label}>{inner}</div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-widest text-neutral-400">
            Standort
          </h2>
          <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50">
            <div className="text-center">
              <MapPin className="mx-auto mb-2 h-8 w-8 text-neutral-300" />
              <p className="text-sm font-medium text-neutral-400">
                Kartenansicht folgt in Kürze
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-widest text-neutral-400">
            Öffnungszeiten
          </h2>
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <Clock
                className="mt-0.5 h-5 w-5 shrink-0"
              />
              <div>
                <p className="text-sm font-semibold text-neutral-900">
                  Bürozeiten &amp; Erreichbarkeit
                </p>
                <p className="mt-1 text-sm text-neutral-400 italic">
                  Öffnungszeiten werden in Kürze hinterlegt.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <InlineCTA
            label={`Lust auf ein Probetraining bei ${siteName}?`}
            description="Komm einfach vorbei — wir freuen uns auf dich."
            href={`/${tenantKey}/anmeldung#probetraining`}
            buttonLabel="Probetraining anfragen"
            theme={theme}
            analyticsEvent="cta_contact_probetraining"
          />
        </section>
      </div>
    </main>
  );
}
