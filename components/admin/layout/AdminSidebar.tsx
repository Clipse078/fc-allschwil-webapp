"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import SignOutButton from "@/components/admin/layout/SignOutButton";
import { BRANDING } from "@/lib/config/branding";

type NavItem = {
  label: string;
  href: string;
  parentLabel?: string;
  badgeCount?: number;
  highlight?: boolean;
};

type AdminSidebarProps = {
  navItems: NavItem[];
  firstName: string;
  lastName: string;
  currentSeasonLabel: string;
  collapsed?: boolean;
  onToggle?: () => void;
};

export default function AdminSidebar(props: AdminSidebarProps) {
  const {
    navItems,
    firstName,
    lastName,
    currentSeasonLabel,
    collapsed,
    onToggle,
  } = props;

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedSeason = searchParams.get("season");

  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const resolvedCollapsed =
    typeof collapsed === "boolean" ? collapsed : internalCollapsed;

  const handleToggle =
    typeof onToggle === "function"
      ? onToggle
      : () => setInternalCollapsed((c) => !c);

  const topLevel = navItems.filter((i) => !i.parentLabel);

  function buildHref(href: string) {
    if (!selectedSeason) return href;
    if (!href.startsWith("/dashboard")) return href;
    return `${href}?season=${encodeURIComponent(selectedSeason)}`;
  }

  return (
    <aside className={`${resolvedCollapsed ? "w-[90px]" : "w-[280px]"} flex min-h-screen flex-col border-r bg-white transition-all`}>
      
      {/* HEADER */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/images/logos/fc-allschwil.png" alt="logo" width={36} height={36}/>
            {!resolvedCollapsed && (
              <div>
                <p className="text-xs text-red-600 uppercase">{BRANDING.clubName}</p>
                <p className="font-bold text-[#0b4aa2]">{BRANDING.systemName}</p>
              </div>
            )}
          </div>

          <button onClick={handleToggle}>
            {resolvedCollapsed ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}
          </button>
        </div>

        {!resolvedCollapsed && (
          <div className="mt-4 text-sm text-slate-600">
            Saison: <strong>{currentSeasonLabel}</strong>
          </div>
        )}
      </div>

      {/* NAV */}
      <nav className="flex-1 p-3 space-y-2">
        {topLevel.map((item) => {
          const active = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={buildHref(item.href)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm
                ${active ? "bg-blue-50 text-[#0b4aa2]" : "text-slate-600 hover:bg-slate-50"}
                ${item.highlight ? "border border-red-300 bg-red-50" : ""}
              `}
            >
              <span>{item.label}</span>

              {item.badgeCount && item.badgeCount > 0 && (
                <span className="ml-2 text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">
                  {item.badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* USER */}
      <div className="p-4 border-t">
        {!resolvedCollapsed && (
          <div className="text-sm mb-2">
            {firstName} {lastName}
          </div>
        )}
        <SignOutButton collapsed={resolvedCollapsed} />
      </div>
    </aside>
  );
}
