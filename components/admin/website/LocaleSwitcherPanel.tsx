import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { createLocaleVariant } from "@/app/(admin)/dashboard/website/pages/[pageId]/actions";

const SUPPORTED_LOCALES = ["de", "fr", "it", "en"] as const;
const LOCALE_LABELS: Record<string, string> = {
  de: "Deutsch",
  fr: "Français",
  it: "Italiano",
  en: "English",
};

const STATUS_DOT: Record<string, string> = {
  DRAFT: "bg-slate-300",
  REVIEW: "bg-amber-400",
  PUBLISHED: "bg-emerald-500",
  ARCHIVED: "bg-rose-400",
};

type Props = {
  pageId: string;
  siteId: string;
  slug: string;
  currentLocale: string;
};

export default async function LocaleSwitcherPanel({
  pageId,
  siteId,
  slug,
  currentLocale,
}: Props) {
  const siblings = await prisma.websitePage.findMany({
    where: { siteId, slug },
    select: { id: true, locale: true, status: true },
  });

  const localeMap = new Map(siblings.map((s) => [s.locale, s]));
  const existingLocales = new Set(siblings.map((s) => s.locale));
  const missingLocales = SUPPORTED_LOCALES.filter((l) => !existingLocales.has(l));

  if (siblings.length <= 1 && missingLocales.length === 0) return null;

  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        Sprachversionen · /{slug}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {SUPPORTED_LOCALES.filter((l) => existingLocales.has(l)).map((locale) => {
          const sibling = localeMap.get(locale);
          if (!sibling) return null;
          const isCurrent = sibling.id === pageId;

          return isCurrent ? (
            <span
              key={locale}
              className="flex items-center gap-1.5 rounded-full border border-[#0b4aa2] bg-[#0b4aa2]/5 px-3 py-1 text-[12px] font-semibold text-[#0b4aa2]"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[sibling.status] ?? "bg-slate-300"}`}
              />
              {locale.toUpperCase()} · {LOCALE_LABELS[locale] ?? locale}
            </span>
          ) : (
            <Link
              key={locale}
              href={`/dashboard/website/pages/${sibling.id}`}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[sibling.status] ?? "bg-slate-300"}`}
              />
              {locale.toUpperCase()} · {LOCALE_LABELS[locale] ?? locale}
            </Link>
          );
        })}

        {/* Create missing locale variants */}
        {missingLocales.map((locale) => (
          <form key={locale} action={createLocaleVariant}>
            <input type="hidden" name="sourcePageId" value={pageId} />
            <input type="hidden" name="targetLocale" value={locale} />
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3 py-1 text-[12px] font-semibold text-slate-400 transition hover:border-[#0b4aa2]/40 hover:text-[#0b4aa2]"
            >
              <Plus className="h-3 w-3" />
              {locale.toUpperCase()} hinzufügen
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
