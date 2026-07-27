"use client";

/**
 * ProviderMappingFilters
 *
 * Search and filter bar for the provider mapping overview.
 * Updates URL search params for server-side filtering.
 *
 * German UI.
 */

import { useRouter, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { useCallback } from "react";

type Props = {
  currentProvider?: string;
  currentSearch?: string;
  currentMappingSource?: string;
};

export default function ProviderMappingFilters({
  currentProvider,
  currentSearch,
  currentMappingSource,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const updateParam = useCallback(
    (key: string, value: string | undefined) => {
      const sp = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      if (value) {
        sp.set(key, value);
      } else {
        sp.delete(key);
      }
      router.push(`${pathname}?${sp.toString()}`);
    },
    [router, pathname],
  );

  const clearAll = () => {
    router.push(pathname);
  };

  const hasFilters = currentProvider || currentSearch || currentMappingSource;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Team oder Anbieter-Team suchen…"
          defaultValue={currentSearch ?? ""}
          onChange={(e) => updateParam("search", e.target.value || undefined)}
          className="pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-64 bg-white"
        />
      </div>

      {/* Provider filter */}
      <select
        value={currentProvider ?? ""}
        onChange={(e) => updateParam("provider", e.target.value || undefined)}
        className="py-2 px-3 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
      >
        <option value="">Alle Anbieter</option>
        <option value="SFV">SFV</option>
      </select>

      {/* Source filter */}
      <select
        value={currentMappingSource ?? ""}
        onChange={(e) => updateParam("mappingSource", e.target.value || undefined)}
        className="py-2 px-3 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
      >
        <option value="">Alle Quellen</option>
        <option value="MANUAL">Manuell</option>
        <option value="SYNC">Sync</option>
      </select>

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={clearAll}
          className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Filter zurücksetzen
        </button>
      )}
    </div>
  );
}
