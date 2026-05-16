import Link from "next/link";
import type { ResolvedCTA } from "@/lib/website/cta-system";
import type { SiteTheme } from "@/lib/website/theme-engine";

type WebsiteCTASectionProps = {
  ctas: ResolvedCTA[];
  theme: SiteTheme;
  eyebrow?: string;
  title?: string;
};

export default function WebsiteCTASection({
  ctas,
  theme,
  eyebrow,
  title,
}: WebsiteCTASectionProps) {
  if (ctas.length === 0) return null;

  return (
    <section className="bg-white py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {(eyebrow || title) && (
          <div className="mb-8 text-center">
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
                {title}
              </h2>
            )}
          </div>
        )}

        <div
          className={`grid gap-4 ${
            ctas.length === 1
              ? "max-w-md mx-auto"
              : ctas.length === 2
                ? "sm:grid-cols-2"
                : "sm:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {ctas.map((cta) => (
            <Link
              key={cta.key}
              href={cta.href}
              target={cta.target === "blank" ? "_blank" : undefined}
              rel={cta.target === "blank" ? "noopener noreferrer" : undefined}
              className="group flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-6 transition hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-sm"
              data-cta={cta.analyticsEvent}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: theme.primaryColor }}
              >
                <span className="text-sm font-bold">{cta.label[0]}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900 group-hover:text-blue-800 transition-colors">
                  {cta.label}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                  {cta.description}
                </p>
              </div>
              <span
                className="mt-auto text-xs font-semibold transition-colors group-hover:underline"
                style={{ color: theme.primaryColor }}
              >
                Mehr →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
