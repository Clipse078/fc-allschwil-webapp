import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

type AdminModulePlaceholderLink = {
  title: string;
  description: string;
  href: string;
};

type AdminModulePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  notice?: string;
  links?: AdminModulePlaceholderLink[];
};

export default function AdminModulePlaceholder({
  eyebrow,
  title,
  description,
  notice = "Demo-Placeholder für Freitag. Inhalt und Datenmodell folgen im nächsten Ausbauschritt.",
  links = [],
}: AdminModulePlaceholderProps) {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />
        <div className="grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)] lg:px-8 lg:py-8">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">
                {eyebrow}
              </p>
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                Coming soon
              </span>
            </div>

            <h2 className="mt-3 text-[2rem] font-semibold tracking-[-0.03em] text-slate-900 md:text-[2.35rem]">
              {title}
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-[15px]">
              {description}
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-[#0b4aa2] shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-900">Friday demo placeholder</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">{notice}</p>
          </div>
        </div>
      </section>

      {links.length > 0 ? (
        <section className="rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Teilmodule
              </p>
              <h3 className="mt-2 text-[1.4rem] font-semibold tracking-tight text-slate-900">
                Vorbereitete Demo-Einstiege
              </h3>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm transition hover:-translate-y-[2px] hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[#0b4aa2]">{link.title}</p>
                      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                        Soon
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{link.description}</p>
                  </div>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-[#0b4aa2]" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}