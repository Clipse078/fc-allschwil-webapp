"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Loader2 } from "lucide-react";
import type { TenantOption } from "@/lib/tenants/queries";

type TenantSwitcherProps = {
  availableTenants: TenantOption[];
  activeTenantId?: string;
  activeTenantName?: string;
};

export default function TenantSwitcher({
  availableTenants,
  activeTenantId,
  activeTenantName,
}: TenantSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState(activeTenantId ?? "");
  const [error, setError] = useState<string | null>(null);

  const displayName =
    activeTenantName ??
    availableTenants.find((t) => t.id === activeTenantId)?.displayName ??
    availableTenants.find((t) => t.id === activeTenantId)?.name ??
    null;

  async function handleSwitch(tenantId: string) {
    if (tenantId === activeTenantId || isPending) return;

    const previousId = selectedId;
    setSelectedId(tenantId);
    setError(null);

    try {
      const res = await fetch("/api/tenant/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Switch fehlgeschlagen.");
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setSelectedId(previousId);
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    }
  }

  if (availableTenants.length === 0) {
    return null;
  }

  const activeTenant = availableTenants.find((t) => t.id === selectedId);
  const chipColor = activeTenant?.primaryColor ?? null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm"
          style={chipColor ? { borderColor: chipColor, color: chipColor } : undefined}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
          ) : (
            <Building2 className="h-3.5 w-3.5" style={chipColor ? { color: chipColor } : undefined} />
          )}
        </div>

        {availableTenants.length > 1 ? (
          <div className="relative">
            <select
              value={selectedId}
              disabled={isPending}
              onChange={(e) => handleSwitch(e.target.value)}
              className="appearance-none cursor-pointer rounded-[12px] border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-slate-700 shadow-sm outline-none transition hover:border-slate-300 focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/10 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Aktiven Tenant wechseln"
            >
              {!selectedId && (
                <option value="" disabled>
                  — Tenant wählen —
                </option>
              )}
              {availableTenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.displayName ?? tenant.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
          </div>
        ) : (
          <span className="rounded-[12px] border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
            {displayName ?? availableTenants[0]?.displayName ?? availableTenants[0]?.name ?? "—"}
          </span>
        )}
      </div>

      {error ? (
        <p className="pl-9 text-xs text-rose-600">{error}</p>
      ) : null}
    </div>
  );
}
