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

type InboardOverviewProps = {
  boards: InfoboardListItem[];
  totalCount: number;
  activeCount: number;
};

export function InboardOverview({
  boards: initialBoards,
  totalCount,
  activeCount,
}: InboardOverviewProps) {
  const router = useRouter();
  const [boards, setBoards] = useState(initialBoards);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

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

  return (
    <>
      {/* Summary + CTA */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-2)]">
          {totalCount === 0
            ? "Keine Infoboards"
            : `${totalCount} ${totalCount === 1 ? "Infoboard" : "Infoboards"} · ${activeCount} aktiv`}
        </p>
        <button
          onClick={() => setCreateOpen(true)}
          className="fca-button-primary inline-flex items-center gap-2"
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <InboardCard
              key={board.id}
              board={board}
              onDuplicate={handleDuplicate}
              onDelete={(id, name) => setDeleteTarget({ id, name })}
              onToggleStatus={handleToggleStatus}
            />
          ))}
        </div>
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
