"use client";

/**
 * components/infoboard/v2/InboardCard.tsx
 *
 * Overview card for a single Infoboard in the management grid.
 * Renders name, status, template, theme, announcement state,
 * and primary actions (Öffnen, Bearbeiten, overflow menu).
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  Settings,
  MoreHorizontal,
  Copy,
  Trash2,
  Monitor,
  Power,
  PowerOff,
} from "lucide-react";
import type { InfoboardListItem } from "@/lib/infoboard/types";
import { STATUS_META, TEMPLATE_LABELS, infoboardKioskUrl } from "@/lib/infoboard/types";

type InboardCardProps = {
  board: InfoboardListItem;
  onDuplicate: (id: string) => Promise<void>;
  onDelete: (id: string, name: string) => void;
  onToggleStatus: (id: string, currentStatus: string) => Promise<void>;
};

export function InboardCard({
  board,
  onDuplicate,
  onDelete,
  onToggleStatus,
}: InboardCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copying, setCopying] = useState(false);

  const statusMeta = STATUS_META[board.status] ?? { label: board.status, color: "gray" };
  const templateLabel = TEMPLATE_LABELS[board.templateType] ?? board.templateType;
  const kioskUrl = infoboardKioskUrl(board.slug);

  const statusDotClass =
    statusMeta.color === "green"
      ? "bg-emerald-500"
      : statusMeta.color === "amber"
        ? "bg-amber-400"
        : "bg-[var(--muted)]";

  async function handleCopyUrl() {
    setCopying(true);
    try {
      const fullUrl = `${window.location.origin}${kioskUrl}`;
      await navigator.clipboard.writeText(fullUrl);
    } finally {
      setTimeout(() => setCopying(false), 1500);
    }
    setMenuOpen(false);
  }

  return (
    <div className="relative rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5 transition-shadow hover:shadow-sm">
      {/* Top: template label + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
            {templateLabel}
          </p>
          <h3 className="mt-0.5 text-base font-semibold text-[var(--foreground)] truncate">
            {board.name}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          <span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
          <span className="text-[0.72rem] font-medium text-[var(--text-2)]">
            {statusMeta.label}
          </span>
        </div>
      </div>

      {/* Details row */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        <div className="flex items-center gap-1.5">
          <Monitor className="h-3 w-3 text-[var(--muted)]" />
          <span className="text-[0.72rem] text-[var(--text-2)]">
            {board.displayTheme === "LIGHT" ? "Hell" : "Dunkel"}
          </span>
        </div>
        {board.announcementEnabled && (
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            <span className="text-[0.72rem] text-[var(--text-2)]">Hinweisleiste: Aktiv</span>
          </div>
        )}
      </div>

      {/* Kiosk URL */}
      <div className="mt-3">
        <code className="text-[0.68rem] font-mono text-[var(--muted)] bg-[var(--surface-3)] px-2 py-0.5 rounded-md">
          {kioskUrl}
        </code>
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        <Link
          href={kioskUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="fca-button-secondary inline-flex items-center gap-1.5 text-[0.78rem] px-3 py-1.5"
        >
          <ExternalLink className="h-3 w-3" />
          Öffnen
        </Link>
        <Link
          href={`/dashboard/infoboard/${board.id}`}
          className="fca-button-primary inline-flex items-center gap-1.5 text-[0.78rem] px-3 py-1.5"
        >
          <Settings className="h-3 w-3" />
          Bearbeiten
        </Link>

        {/* Overflow menu */}
        <div className="relative ml-auto">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-[var(--muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)] transition-colors"
            aria-label="Mehr Optionen"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-8 z-20 min-w-[180px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-lg py-1">
                <button
                  onClick={() => { handleCopyUrl(); }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[0.8rem] text-[var(--foreground)] hover:bg-[var(--surface-3)]"
                >
                  <Copy className="h-3.5 w-3.5 text-[var(--muted)]" />
                  {copying ? "Kopiert!" : "URL kopieren"}
                </button>
                <button
                  onClick={async () => {
                    setMenuOpen(false);
                    await onDuplicate(board.id);
                    router.refresh();
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[0.8rem] text-[var(--foreground)] hover:bg-[var(--surface-3)]"
                >
                  <Copy className="h-3.5 w-3.5 text-[var(--muted)]" />
                  Duplizieren
                </button>
                <div className="my-1 border-t border-[var(--border)]" />
                <button
                  onClick={async () => {
                    setMenuOpen(false);
                    await onToggleStatus(
                      board.id,
                      board.status,
                    );
                    router.refresh();
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[0.8rem] text-[var(--foreground)] hover:bg-[var(--surface-3)]"
                >
                  {board.status === "ACTIVE" ? (
                    <>
                      <PowerOff className="h-3.5 w-3.5 text-[var(--muted)]" />
                      Deaktivieren
                    </>
                  ) : (
                    <>
                      <Power className="h-3.5 w-3.5 text-[var(--muted)]" />
                      Aktivieren
                    </>
                  )}
                </button>
                <div className="my-1 border-t border-[var(--border)]" />
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(board.id, board.name);
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[0.8rem] text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Löschen
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
