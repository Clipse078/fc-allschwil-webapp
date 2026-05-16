import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { getPublicSiteData } from "@/lib/website/public-queries";
import { buildTheme } from "@/lib/website/theme-engine";
import { resolveRegistrationCTAs } from "@/lib/website/cta-system";
import { submitRegistrationInterestAction } from "./actions";

type AnmeldungPageProps = {
  params: Promise<{ tenantKey: string }>;
  searchParams: Promise<{ status?: string; type?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Anmeldung & Interesse",
    robots: { index: true, follow: true },
  };
}

const SECTION_ICONS: Record<string, string> = {
  probetraining: "⚽",
  mitglied: "🤝",
  trainer: "📋",
  sponsor: "🏆",
};

const TYPE_MAP: Record<string, string> = {
  probetraining: "REGISTRATION_INTEREST",
  mitglied: "REGISTRATION_INTEREST",
  trainer: "TRAINER_INTEREST",
  sponsor: "SPONSOR_INTEREST",
};

const inputCls =
  "w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

export default async function AnmeldungPage({
  params,
  searchParams,
}: AnmeldungPageProps) {
  const { tenantKey } = await params;
  const { status, type: submittedType } = await searchParams;
  const site = await getPublicSiteData(tenantKey);
  const theme = buildTheme(site ?? { name: tenantKey });
  const ctas = resolveRegistrationCTAs(tenantKey);
  const siteName = site?.name ?? tenantKey;

  const justSent = status === "sent" && submittedType;

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Mitmachen
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Jetzt durchstarten
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-neutral-600">
          Bei {siteName} ist jeder willkommen. Füll das Formular aus — wir melden uns.
        </p>
      </header>

      {justSent && (
        <div className="mb-8 flex flex-col items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
          <CheckCircle className="h-10 w-10 text-green-500" />
          <div>
            <p className="text-base font-bold text-green-900">Interesse erhalten!</p>
            <p className="mt-1 text-sm text-green-700">
              Danke für deine Anfrage. Wir melden uns in Kürze.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {ctas.map((cta) => {
          const inquiryType = TYPE_MAP[cta.key] ?? "REGISTRATION_INTEREST";
          const isSent = justSent && submittedType === inquiryType && cta.key === submittedType;

          return (
            <section
              key={cta.key}
              id={cta.key}
              className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
                  style={{ backgroundColor: `${theme.primaryColor}12` }}
                >
                  {SECTION_ICONS[cta.key] ?? "✦"}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-neutral-900">{cta.label}</h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
                    {cta.description}
                  </p>
                </div>
              </div>

              <form action={submitRegistrationInterestAction} className="space-y-3">
                <input type="hidden" name="tenantKey" value={tenantKey} />
                <input type="hidden" name="inquiryType" value={inquiryType} />
                <input type="hidden" name="topic" value={cta.label} />
                {/* Honeypot */}
                <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", opacity: 0, pointerEvents: "none" }}>
                  <input type="text" name="website_url" tabIndex={-1} autoComplete="off" />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Name *</span>
                    <input type="text" name="name" required placeholder="Max Muster" className={inputCls} />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">E-Mail *</span>
                    <input type="email" name="email" required placeholder="max@beispiel.ch" className={inputCls} />
                  </label>
                </div>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Telefon</span>
                  <input type="tel" name="phone" placeholder="+41 79 123 45 67" className={inputCls} />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Nachricht</span>
                  <textarea name="message" rows={2} placeholder="Kurze Mitteilung …" className={`${inputCls} resize-none`} />
                </label>

                <button
                  type="submit"
                  className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  Interesse bekunden
                </button>
              </form>
            </section>
          );
        })}
      </div>

      <div className="mt-10 rounded-2xl border border-neutral-100 bg-neutral-50 p-5 text-center">
        <p className="text-sm text-neutral-600">
          Andere Fragen?{" "}
          <Link
            href={`/${tenantKey}/kontakt`}
            className="font-semibold underline"
            style={{ color: theme.primaryColor }}
          >
            Schreib uns direkt.
          </Link>
        </p>
      </div>
    </main>
  );
}
