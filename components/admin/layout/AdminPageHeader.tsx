"use client";

import { usePathname } from "next/navigation";
import { getAdminRouteHeader } from "@/lib/platform/admin-route-config";

export default function AdminPageHeader() {
  const pathname = usePathname();
  const { eyebrow, title, description } = getAdminRouteHeader(pathname);

  return (
    <div>
      <p className="fca-eyebrow">{eyebrow}</p>
      <h1 className="fca-heading mt-2">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm text-slate-500">{description}</p>
    </div>
  );
}
