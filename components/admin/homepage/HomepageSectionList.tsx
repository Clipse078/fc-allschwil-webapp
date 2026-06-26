"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LayoutTemplate,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Info,
} from "lucide-react";
import { SectionCard, EmptyState } from "@/components/ui/page";
import type { HomepageSectionAdminItem } from "@/lib/homepage/admin-queries";
import { getHomepageSectionType } from "@/lib/homepage/section-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SectionTypeBadge({ type }: { type: string }) {
  const def = getHomepageSectionType(type);
  const isPlaceholder = def?.implementation === "placeholder";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${
        isPlaceholder
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)]"
      }`}
    >
      {def?.label ?? type}
    </span>
  );
}

function EnabledBadge({ isEnabled }: { isEnabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        isEnabled
          ? "bg-emerald-50 text-emerald-700"
          : "bg-[var(--surface-2)] text-[var(--muted)]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isEnabled ? "bg-emerald-500" : "bg-gray-300"}`}
      />
      {isEnabled ? "Aktiv" : "Deaktiviert"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function HomepageSectionList() {
  const [sections, setSections] = useState<HomepageSectionAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/homepage-sections");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Ladefehler");
      setSections(data.sections ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggle(id: string) {
    setActionPending(id);
    try {
      const res = await fetch(`/api/homepage-sections/${id}/toggle`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error ?? "Fehler beim Umschalten");
        return;
      }
      setSections((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, isEnabled: data.section.isEnabled } : s,
        ),
      );
    } finally {
      setActionPending(null);
    }
  }

  async function handleMove(id: string, direction: "up" | "down") {
    setActionPending(`${id}-${direction}`);
    try {
      const res = await fetch(`/api/homepage-sections/${id}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error ?? "Fehler beim Verschieben");
        return;
      }
      setSections(data.sections ?? []);
    } finally {
      setActionPending(null);
    }
  }

  async function handleBootstrap() {
    if (
      !confirm(
        "Standard-Sektionen erstellen? Dies legt alle 8 Standard-Sektionen an. Vorgang kann nicht rückgängig gemacht werden.",
      )
    )
      return;

    setBootstrapping(true);
    try {
      const res = await fetch("/api/homepage-sections", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error ?? "Fehler beim Erstellen der Standard-Sektionen");
        return;
      }
      await load();
    } finally {
      setBootstrapping(false);
    }
  }

  const isAnyActionPending = actionPending !== null || bootstrapping;

  return (
    <SectionCard noPadding>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
        <div className="flex items-center gap-2">
          <p className="text-xs text-[var(--muted)]">
            {loading
              ? "Wird geladen…"
              : `${sections.length} Sektion${sections.length !== 1 ? "en" : ""} konfiguriert`}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading || isAnyActionPending}
          className="fca-button-secondary px-2.5"
          title="Aktualisieren"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 border-b border-[var(--border)] bg-blue-50 px-5 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
        <p className="text-xs text-blue-700">
          <span className="font-semibold">Homepage Builder Foundation.</span>{" "}
          Sektionen können aktiviert, deaktiviert und umsortiert werden. Der
          visuelle Editor und erweiterte Konfiguration folgen in einem späteren
          Slice.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 border-b border-rose-100 bg-rose-50 px-5 py-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Content */}
      {loading && sections.length === 0 ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-[var(--radius-xl)] bg-[var(--surface-2)]"
            />
          ))}
        </div>
      ) : sections.length === 0 ? (
        <EmptyState
          icon={<LayoutTemplate className="h-10 w-10" />}
          heading="Keine Sektionen konfiguriert"
          description="Erstelle die Standard-Sektionen, um mit dem Homepage Builder zu starten."
          action={
            <button
              type="button"
              onClick={handleBootstrap}
              disabled={bootstrapping}
              className="fca-button-primary"
            >
              <Sparkles className="h-4 w-4" />
              {bootstrapping ? "Wird erstellt…" : "Standard-Sektionen erstellen"}
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-2)]">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Reihenfolge
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Sektion
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Typ
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Status
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {sections.map((section, idx) => {
                const def = getHomepageSectionType(section.type);
                const isFirst = idx === 0;
                const isLast = idx === sections.length - 1;
                const isThisPending =
                  actionPending === section.id ||
                  actionPending === `${section.id}-up` ||
                  actionPending === `${section.id}-down`;

                return (
                  <tr
                    key={section.id}
                    className={`bg-[var(--surface)] transition hover:bg-[var(--surface-2)] ${
                      !section.isEnabled ? "opacity-60" : ""
                    }`}
                  >
                    {/* Sort position */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-[var(--muted)]">
                        {String(section.sortOrder).padStart(2, "0")}
                      </span>
                    </td>

                    {/* Label + description */}
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-[var(--foreground)]">
                          {section.label}
                        </p>
                        {def && (
                          <p className="mt-0.5 text-[11px] text-[var(--muted)] line-clamp-1">
                            {def.description}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Type badge */}
                    <td className="px-4 py-3">
                      <SectionTypeBadge type={section.type} />
                    </td>

                    {/* Enabled badge */}
                    <td className="px-4 py-3">
                      <EnabledBadge isEnabled={section.isEnabled} />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Move up */}
                        <button
                          type="button"
                          onClick={() => handleMove(section.id, "up")}
                          disabled={isFirst || isAnyActionPending}
                          className="sce-icon-button disabled:opacity-30"
                          title="Nach oben"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>

                        {/* Move down */}
                        <button
                          type="button"
                          onClick={() => handleMove(section.id, "down")}
                          disabled={isLast || isAnyActionPending}
                          className="sce-icon-button disabled:opacity-30"
                          title="Nach unten"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>

                        {/* Toggle enable/disable */}
                        <button
                          type="button"
                          onClick={() => handleToggle(section.id)}
                          disabled={isThisPending || isAnyActionPending}
                          className={`sce-icon-button ${
                            section.isEnabled
                              ? "text-emerald-600 hover:text-emerald-800"
                              : "text-[var(--muted)] hover:text-[var(--foreground)]"
                          }`}
                          title={section.isEnabled ? "Deaktivieren" : "Aktivieren"}
                        >
                          {section.isEnabled ? (
                            <Eye className="h-3.5 w-3.5" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer count */}
      {!loading && sections.length > 0 && (
        <div className="border-t border-[var(--border)] px-5 py-3">
          <p className="text-[11px] text-[var(--muted)]">
            {sections.filter((s) => s.isEnabled).length} von{" "}
            {sections.length} Sektionen aktiv · sichtbar in der öffentlichen
            Homepage-API
          </p>
        </div>
      )}
    </SectionCard>
  );
}
