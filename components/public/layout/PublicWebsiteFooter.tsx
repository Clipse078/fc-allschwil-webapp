import Link from "next/link";
import type { SiteTheme } from "@/lib/website/theme-engine";

type PublicWebsiteFooterProps = {
  theme: SiteTheme;
  tenantKey: string;
};

export default function PublicWebsiteFooter({
  theme,
  tenantKey,
}: PublicWebsiteFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p
              className="font-[var(--font-display)] text-xl font-bold uppercase tracking-tight"
              style={{ color: theme.primaryColor }}
            >
              {theme.name}
            </p>
            {theme.tagline && (
              <p className="mt-1 text-sm text-neutral-500">{theme.tagline}</p>
            )}
          </div>

          <nav aria-label="Footer-Navigation">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {[
                { label: "News", href: `/${tenantKey}/news` },
                { label: "Events", href: `/${tenantKey}/events` },
                { label: "Teams", href: `/${tenantKey}/teams` },
                { label: "Sponsoren", href: `/${tenantKey}/sponsoren` },
                { label: "Kontakt", href: `/${tenantKey}/kontakt` },
              ].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-neutral-500 transition-colors hover:text-neutral-900"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-8 border-t border-neutral-100 pt-6">
          <p className="text-xs text-neutral-400">
            {theme.footerText ??
              `© ${year} ${theme.name}. Alle Rechte vorbehalten.`}
          </p>
        </div>
      </div>
    </footer>
  );
}
