"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

function getPageTitle(pathname: string) {
  if (pathname.startsWith("/vereinsleitung/meetings")) return "Meetings";
  if (pathname.startsWith("/vereinsleitung/initiativen")) return "Initiativen";
  if (pathname.startsWith("/vereinsleitung")) return "Vereinsleitung";
  if (pathname.startsWith("/teams")) return "Teams";
  if (pathname.startsWith("/users")) return "Benutzer";
  return "Dashboard";
}

export default function AdminHeader() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur">
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0b4aa2] to-[#d62839]">
          <Image
            src="/images/logos/fc-allschwil.png"
            alt="FCA"
            width={24}
            height={24}
            className="h-6 w-6 object-contain"
          />
        </div>

        {/* Page Title */}
        <div className="text-lg font-semibold text-slate-900">
          {title}
        </div>
      </div>

      {/* Right side placeholder (future: user menu / search) */}
      <div className="flex items-center gap-3">
        {/* keep empty for now → avoids layout shift later */}
      </div>
    </header>
  );
}