"use client";

/**
 * components/infoboard/v2/InboardOverview.tsx
 *
 * Client-side management workspace for all tenant Infoboards.
 * Handles create, duplicate, delete, and toggle-status actions.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Monitor } from "lucide-react";
import type { InfoboardListItem } from "@/lib/infoboard/types";
import { InboardCard } from "./InboardCard";
import { CreateInboardDialog } from "./CreateInboardDialog";
import { DeleteInboardDialog } from "./DeleteInboardDialog";

type StatusFilter = "all" | "active" | "draft" | "disabled";

type InboardOverviewProps = {
  boards: InfoboardListItem[];
  totalCount: number;
  activeCount: number;
  draftCount: number;
  disabledCount: number;
};

export function InboardOverview({
  boards: initialBoards,
  totalCount,
  activeCount,
  draftCount,
  disabledCount,
}: InboardOverviewProps) {
  const router = useRouter();
  const [boards, setBoards] = useState(initialBoards);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  async function handleDuplicate(id: string) {
    const res = await fetch(`/api/infoboards/${id}/duplicate`, { method: "POST" });
    if (res.ok) {
      router.refresh();
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/infoboards/${id}`, { method: "DELETE" });
    if (res.ok) {
      setBoards((prev) => prev.filter((b) => b.id !== id));
      router.refresh();
    }
  }

  async function handleToggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === "ACTIVE" ? "DISABLED" : "ACTIVE";
    const res = await fetch(`/api/infoboards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      router.refresh();
    }
  }

  const filteredBoards = boards.filter((b) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "active") return b.status === "ACTIVE";
    if (statusFilter === "draft") return b.status === "DRAFT";
    if (statusFilter === "disabled") return b.status === "DISABLED";
    return true;
  });

  const chips: { id: StatusFilter; label: string; count: number }[] = [
    { id: "all", label: "Alle", count: totalCount },
    { id: "active", label: "Aktiv", count: activeCount },
    { id: "draft", label: "Entwürfe", count: draftCount },
    { id: "disabled", label: "Inaktiv", count: disabledCount },
  ];

  return (
    <>
      {/* Header row: status chips + CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Status filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {chips.map((chip) => (
            <button
              key={chip.id}
              onClick={() => setStatusFilter(chip.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.75rem] font-medium transition-colors ${
                statusFilter === chip.id
                  ? "bg-[var(--sce-primary)] text-white"
                  : "bg-[var(--surface-3)] text-[var(--text-2)] hover:bg-[var(--border)] hover:text-[var(--foreground)]"
              }`}
            >
              {chip.label}
              {chip.count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold leading-none ${
                    statusFilter === chip.id
                      ? "bg-white/20 text-white"
                      : "bg-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {chip.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={() => setCreateOpen(true)}
          className="fca-button-primary inline-flex items-center gap-2 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Infoboard erstellen
        </button>
      </div>

      {/* Grid */}
      {boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-2xl)] border border-dashed border-[var(--border)] bg-[var(--surface)] py-16">
          <Monitor className="h-8 w-8 text-[var(--muted)] mb-3" />
          <p className="text-sm font-medium text-[var(--foreground)]">
            Noch keine Infoboards
          </p>
          <p className="mt-1 text-sm text-[var(--text-2)]">
            Erstelle dein erstes Display für einen Bereich deiner Anlage.
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            className="mt-4 fca-button-primary inline-flex items-center gap-2"
          >
            <Plus className="h-3.5 w-3.5" />
            Infoboard erstellen
          </button>
        </div>
      ) : (
        <>
          {filteredBoards.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-[var(--border)] bg-[var(--surface)] py-10">
              <p className="text-sm text-[var(--muted)]">
                Keine Infoboards in dieser Kategorie.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredBoards.map((board) => (
                <InboardCard
                  key={board.id}
                  board={board}
                  onDuplicate={handleDuplicate}
                  onDelete={(id, name) => setDeleteTarget({ id, name })}
                  onToggleStatus={handleToggleStatus}
                />
              ))}
              {/* "Infoboard erstellen" tile — only on "all" filter */}
              {statusFilter === "all" && (
                <button
                  onClick={() => setCreateOpen(true)}
                  className="group flex flex-col items-center justify-center gap-2 rounded-[var(--radius-xl)] border border-dashed border-[var(--border)] bg-[var(--surface)] p-5 text-center transition-colors hover:border-[var(--sce-primary)] hover:bg-[var(--surface-3)] min-h-[180px]"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-[var(--border)] group-hover:border-[var(--sce-primary)] transition-colors">
                    <Plus className="h-4 w-4 text-[var(--muted)] group-hover:text-[var(--sce-primary)] transition-colors" />
                  </div>
                  <div>
                    <p className="text-[0.82rem] font-medium text-[var(--text-2)] group-hover:text-[var(--foreground)] transition-colors">
                      Infoboard erstellen
                    </p>
                    <p className="mt-0.5 text-[0.72rem] text-[var(--muted)]">
                      Neue Anzeige anlegen
                    </p>
                  </div>
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <CreateInboardDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <DeleteInboardDialog
        boardId={deleteTarget?.id ?? null}
        boardName={deleteTarget?.name ?? ""}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
