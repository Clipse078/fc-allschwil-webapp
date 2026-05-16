"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import type { SiteTheme } from "@/lib/website/theme-engine";
import type { WebsiteNavConfig } from "@/lib/website/navigation-config";
import { getRegularNavItems, getCtaNavItems } from "@/lib/website/navigation-config";

type PublicWebsiteNavigationProps = {
  theme: SiteTheme;
  tenantKey: string;
  navConfig: WebsiteNavConfig;
};

export default function PublicWebsiteNavigation({
  theme,
  tenantKey,
  navConfig,
}: PublicWebsiteNavigationProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const regularItems = getRegularNavItems(navConfig);
  const ctaItems = getCtaNavItems(navConfig);
  const allItems = [...regularItems, ...ctaItems];

  function href(slug: string) {
    return slug ? `/${tenantKey}/${slug}` : `/${tenantKey}`;
  }

  function active(slug: string) {
    const h = href(slug);
    return slug === "" ? pathname === h : pathname.startsWith(h);
  }

  return (
    <div className="relative">
      <div className="hidden items-center gap-1 md:flex">
        <ul className="flex items-center gap-0.5">
          {regularItems.map((item) => (
            <li key={item.key}>
              <Link
                href={href(item.slug)}
                target={item.openInNewTab ? "_blank" : undefined}
                className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                  active(item.slug)
                    ? "bg-neutral-100 text-neutral-900"
                    : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                }`}
                style={active(item.slug) ? { color: theme.primaryColor } : undefined}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        {ctaItems.map((item) => (
          <Link
            key={item.key}
            href={href(item.slug)}
            target={item.openInNewTab ? "_blank" : undefined}
            className="ml-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: theme.primaryColor }}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50 md:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Navigation schliessen" : "Navigation öffnen"}
        aria-expanded={open}
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl">
          <ul className="p-2">
            {allItems.map((item) => {
              const isActive = active(item.slug);
              return (
                <li key={item.key}>
                  <Link
                    href={href(item.slug)}
                    target={item.openInNewTab ? "_blank" : undefined}
                    className={`block rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                      item.isCta
                        ? "mt-1 rounded-xl text-white"
                        : isActive
                          ? "bg-neutral-100 text-neutral-900"
                          : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                    }`}
                    style={
                      item.isCta
                        ? { backgroundColor: theme.primaryColor }
                        : isActive
                          ? { color: theme.primaryColor }
                          : undefined
                    }
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
