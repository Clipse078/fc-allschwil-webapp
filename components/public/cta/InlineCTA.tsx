import Link from "next/link";
import type { SiteTheme } from "@/lib/website/theme-engine";

type InlineCTAProps = {
  label: string;
  description?: string;
  href: string;
  buttonLabel?: string;
  theme: SiteTheme;
  analyticsEvent?: string;
};

export default function InlineCTA({
  label,
  description,
  href,
  buttonLabel = "Mehr erfahren",
  theme,
  analyticsEvent,
}: InlineCTAProps) {
  return (
    <div
      className="flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between"
      style={{ backgroundColor: `${theme.primaryColor}0f` }}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-neutral-900">{label}</p>
        {description && (
          <p className="mt-0.5 text-sm text-neutral-600">{description}</p>
        )}
      </div>
      <Link
        href={href}
        data-cta={analyticsEvent}
        className="shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        style={{ backgroundColor: theme.primaryColor }}
      >
        {buttonLabel}
      </Link>
    </div>
  );
}
