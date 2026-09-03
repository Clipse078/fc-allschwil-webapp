"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, Loader2 } from "lucide-react";

type Props = {
  orgUnitId: string;
  position: number;
  total: number;
};

export default function OrgUnitSortControls({ orgUnitId, position, total }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"up" | "down" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (total <= 1) return null;

  async function move(direction: "up" | "down") {
    setLoading(direction);
    setError(null);
    try {
      const res = await fetch(`/api/org-units/${orgUnitId}/sort`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Reihenfolge konnte nicht geändert werden.");
        return;
      }
      router.refresh();
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setLoading(null);
    }
  }

  const isFirst = position === 0;
  const isLast = position === total - 1;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => move("up")}
          disabled={isFirst || loading !== null}
          aria-label="Nach oben"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition hover:border-[var(--blue)] hover:text-[var(--blue)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading === "up" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowUp className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => move("down")}
          disabled={isLast || loading !== null}
          aria-label="Nach unten"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition hover:border-[var(--blue)] hover:text-[var(--blue)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading === "down" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )}
        </button>
        <span className="text-xs text-[var(--muted)]">
          {position + 1} / {total}
        </span>
      </div>
      {error ? (
        <p className="text-xs text-rose-600">{error}</p>
      ) : null}
    </div>
  );
}
