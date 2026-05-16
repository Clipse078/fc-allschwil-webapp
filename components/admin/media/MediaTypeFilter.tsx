"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { MediaAssetListItem } from "@/lib/website/media-queries";

const TYPES = [
  { value: "ALL", label: "Alle" },
  { value: "IMAGE", label: "Bilder" },
  { value: "VIDEO", label: "Videos" },
  { value: "PDF", label: "PDFs" },
  { value: "OTHER", label: "Sonstiges" },
];

type MediaTypeFilterProps = {
  assets: MediaAssetListItem[];
  activeType: string;
};

export default function MediaTypeFilter({
  assets,
  activeType,
}: MediaTypeFilterProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildHref(type: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (type === "ALL") {
      params.delete("type");
    } else {
      params.set("type", type);
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function countFor(type: string) {
    if (type === "ALL") return assets.length;
    return assets.filter((a) => a.type === type).length;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {TYPES.map((t) => {
        const count = countFor(t.value);
        const isActive =
          t.value === "ALL" ? activeType === "ALL" || !activeType : activeType === t.value;

        return (
          <Link
            key={t.value}
            href={buildHref(t.value)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              isActive
                ? "bg-[#0b4aa2] text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
