"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import type { SiteTheme } from "@/lib/website/theme-engine";

const NAV_ITEMS = [
  { label: "Home", slug: "" },
  { label: "News", slug: "news" },
  { label: "Events", slug: "events" },
  { label: "Teams", slug: "teams" },
  { label: "Sponsoren", slug: "sponsoren" },
  { label: "Kontakt", slug: "kontakt" },
] as const;

type PublicWebsiteNavigationProps = {
  theme: SiteTheme;
  tenantKey: string;
};

export default function PublicWebsiteNavigation({
  theme,
  tenantKey,
}: PublicWebsiteNavigationProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  function href(slug: string) {
    return slug ? `/${tenantKey}/${slug}` : `/${tenantKey}`;
  }

  function active(slug: string) {
    const h = href(slug);
    return slug === "" ? pathname === h : pathname.startsWith(h);
  }

  return (
    <div className="relative">
      <ul className="hidden items-center gap-0.5 md:flex">
        {NAV_ITEMS.map((item) => (
          <li key={item.slug}>
            <Link
              href={href(item.slug)}
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
        <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl">
          <ul className="p-2">
            {NAV_ITEMS.map((item) => (
              <li key={item.slug}>
                <Link
                  href={href(item.slug)}
                  className={`block rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    active(item.slug)
                      ? "bg-neutral-100 text-neutral-900"
                      : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                  }`}
                  style={active(item.slug) ? { color: theme.primaryColor } : undefined}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
