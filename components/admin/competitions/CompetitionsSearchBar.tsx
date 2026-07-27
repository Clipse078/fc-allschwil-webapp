"use client";

/**
 * CompetitionsSearchBar
 *
 * Client-side search and filter bar for the Competitions overview page.
 * Updates URL search params on change (no form submit required).
 */

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Search } from "lucide-react";

type Props = {
  initialSearch?: string;
  initialProvider?: string;
  initialIncludeArchived?: boolean;
};

export default function CompetitionsSearchBar({
  initialSearch = "",
  initialProvider = "",
  initialIncludeArchived = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Textsuche */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="search"
          placeholder="Wettkampf suchen…"
          defaultValue={initialSearch}
          onChange={(e) => updateParams({ search: e.target.value || undefined })}
          className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Provider-Filter */}
      <select
        defaultValue={initialProvider}
        onChange={(e) => updateParams({ provider: e.target.value || undefined })}
        className="rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">Alle Provider</option>
        <option value="SFV">SFV</option>
        <option value="MANUAL">Manuell</option>
      </select>

      {/* Archiv-Toggle */}
      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
        <input
          type="checkbox"
          defaultChecked={initialIncludeArchived}
          onChange={(e) =>
            updateParams({ includeArchived: e.target.checked ? "true" : undefined })
          }
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        Archivierte anzeigen
      </label>
    </div>
  );
}
