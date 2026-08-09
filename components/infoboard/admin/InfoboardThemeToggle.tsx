"use client";

/**
 * components/infoboard/admin/InfoboardThemeToggle.tsx
 *
 * INFOBOARD-INTEGRATION-01B — smallest appropriate control for the
 * Infoboard display-theme preference (Dark | Light).
 *
 * Compact segmented toggle. Persists via PATCH /api/infoboard/display-settings,
 * then refreshes the current route so any server-rendered preview reflects
 * the new value. Presentation only — this control never touches planning
 * data, Betriebsplan resolution, or resource allocation.
 *
 * Reusable by a future Screen 2 settings surface: this component only knows
 * about the shared InfoboardDisplayTheme type and the shared API route.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { InfoboardDisplayTheme } from "@/lib/publishing/infoboard/display-theme";

export type InfoboardThemeToggleProps = {
  readonly initialTheme: InfoboardDisplayTheme;
};

const OPTIONS: ReadonlyArray<{ value: InfoboardDisplayTheme; label: string }> = [
  { value: "DARK", label: "Dunkel" },
  { value: "LIGHT", label: "Hell" },
];

export function InfoboardThemeToggle({ initialTheme }: InfoboardThemeToggleProps) {
  const router = useRouter();
  const [theme, setTheme] = useState<InfoboardDisplayTheme>(initialTheme);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(next: InfoboardDisplayTheme) {
    if (next === theme || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/infoboard/display-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Fehler beim Speichern.");
        return;
      }
      setTheme(next);
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="radiogroup"
        aria-label="Infoboard Anzeige-Theme"
        data-testid="infoboard-theme-toggle"
        className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-1"
      >
        {OPTIONS.map((option) => {
          const isActive = option.value === theme;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              data-testid={`infoboard-theme-option-${option.value.toLowerCase()}`}
              disabled={saving}
              onClick={() => handleSelect(option.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.78rem] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                isActive
                  ? "bg-[var(--sce-primary)] text-white shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]",
              )}
            >
              {saving && isActive ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              {option.label}
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="text-[0.72rem] font-medium text-rose-600">{error}</p>
      ) : null}
    </div>
  );
}
