import Image from "next/image";
import Link from "next/link";
import PublicWebsiteNavigation from "./PublicWebsiteNavigation";
import type { SiteTheme } from "@/lib/website/theme-engine";

type PublicWebsiteHeaderProps = {
  theme: SiteTheme;
  tenantKey: string;
};

export default function PublicWebsiteHeader({
  theme,
  tenantKey,
}: PublicWebsiteHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur-xl shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        <Link
          href={`/${tenantKey}`}
          className="flex shrink-0 items-center gap-2.5"
        >
          {theme.logoUrl ? (
            <div className="relative h-9 w-9">
              <Image
                src={theme.logoUrl}
                alt={theme.name}
                fill
                className="object-contain"
                sizes="36px"
                priority
              />
            </div>
          ) : null}
          <span
            className="font-[var(--font-display)] text-xl font-bold uppercase leading-none tracking-tight"
            style={{ color: theme.primaryColor }}
          >
            {theme.name}
          </span>
        </Link>

        <PublicWebsiteNavigation theme={theme} tenantKey={tenantKey} />
      </div>
    </header>
  );
}
