import type { Metadata } from "next";
import { Mail, MapPin, Clock, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { getPublicSiteData } from "@/lib/website/public-queries";
import { buildTheme } from "@/lib/website/theme-engine";
import { submitContactInquiryAction } from "./actions";

type KontaktPageProps = {
  params: Promise<{ tenantKey: string }>;
  searchParams: Promise<{ status?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Kontakt",
    robots: { index: true, follow: true },
  };
}

const TOPIC_OPTIONS = [
  "Allgemeine Anfrage",
  "Probetraining",
  "Mitgliedschaft",
  "Sponsoring",
  "Trainer werden",
  "Medienanfrage",
  "Sonstiges",
];

const inputCls =
  "w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

export default async function KontaktPage({
  params,
  searchParams,
}: KontaktPageProps) {
  const { tenantKey } = await params;
  const { status } = await searchParams;
  const site = await getPublicSiteData(tenantKey);
  const theme = buildTheme(site ?? { name: tenantKey });
  const siteName = site?.name ?? tenantKey;

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Kontakt
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Schreib uns
        </h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-neutral-600">
          Ob Fragen zur Mitgliedschaft, Probetraining oder Sponsoring — wir freuen
          uns von dir zu hören.
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-3">
        <aside className="space-y-6 lg:col-span-1">
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-neutral-400">
              Kontaktinfos
            </h2>
            <div className="space-y-3">
              {[
                { icon: Mail, label: "E-Mail", value: `info@${siteName.toLowerCase().replace(/\s+/g, "")}.ch`, placeholder: true },
                { icon: MapPin, label: "Adresse", value: "Adresse folgt in Kürze.", placeholder: true },
                { icon: Clock, label: "Bürozeiten", value: "Öffnungszeiten folgen.", placeholder: true },
              ].map(({ icon: Icon, label, value, placeholder }) => (
                <div key={label} className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${theme.primaryColor}15`, color: theme.primaryColor }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
                    <p className={`mt-0.5 text-sm ${placeholder ? "text-neutral-400 italic" : "font-medium text-neutral-900"}`}>
                      {value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50">
              <div className="text-center">
                <MapPin className="mx-auto mb-2 h-6 w-6 text-neutral-300" />
                <p className="text-xs text-neutral-400">Karte folgt in Kürze</p>
              </div>
            </div>
          </section>
        </aside>

        <div className="lg:col-span-2">
          {status === "sent" ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-green-200 bg-green-50 p-10 text-center">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <div>
                <h2 className="text-lg font-bold text-green-900">
                  Nachricht erhalten!
                </h2>
                <p className="mt-1 text-sm text-green-700">
                  Danke für deine Anfrage. Wir melden uns so schnell wie möglich.
                </p>
              </div>
              <Link
                href={`/${tenantKey}/kontakt`}
                className="rounded-full border border-green-300 px-5 py-2 text-sm font-medium text-green-800 transition hover:bg-green-100"
              >
                Weitere Nachricht senden
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-base font-semibold text-neutral-900">
                Kontaktformular
              </h2>

              {status === "error" && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                  <p className="text-sm text-red-700">
                    Bitte Name, E-Mail und Nachricht ausfüllen.
                  </p>
                </div>
              )}

              <form action={submitContactInquiryAction} className="space-y-4">
                <input type="hidden" name="tenantKey" value={tenantKey} />
                {/* Honeypot */}
                <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", opacity: 0, pointerEvents: "none" }}>
                  <label htmlFor="website_url_field">Website</label>
                  <input type="text" id="website_url_field" name="website_url" tabIndex={-1} autoComplete="off" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Name *</span>
                    <input type="text" name="name" required placeholder="Max Muster" className={inputCls} />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">E-Mail *</span>
                    <input type="email" name="email" required placeholder="max@beispiel.ch" className={inputCls} />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Telefon</span>
                    <input type="tel" name="phone" placeholder="+41 79 123 45 67" className={inputCls} />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Thema</span>
                    <select name="topic" className={inputCls}>
                      <option value="">Thema wählen …</option>
                      {TOPIC_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Nachricht *</span>
                  <textarea
                    name="message"
                    required
                    rows={5}
                    placeholder="Deine Nachricht…"
                    className={`${inputCls} resize-y`}
                  />
                </label>

                <label className="flex items-start gap-2.5">
                  <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 rounded border-neutral-300" />
                  <span className="text-xs leading-relaxed text-neutral-500">
                    Ich stimme zu, dass meine Angaben zur Bearbeitung meiner Anfrage
                    gespeichert werden. Keine Weitergabe an Dritte.
                  </span>
                </label>

                <button
                  type="submit"
                  className="w-full rounded-xl py-3 text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  Nachricht senden
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
