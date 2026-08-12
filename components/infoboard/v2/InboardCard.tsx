"use client";

/**
 * components/infoboard/v2/InboardCard.tsx
 *
 * Premium overview card for a single Infoboard in the management grid.
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
  Megaphone,
  MegaphoneOff,
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

  const statusBadgeClass =
    statusMeta.color === "green"
      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
      : statusMeta.color === "amber"
        ? "bg-amber-400/10 text-amber-600 border border-amber-400/20"
        : "bg-[var(--surface-3)] text-[var(--muted)] border border-[var(--border)]";

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
    <div className="relative flex flex-col rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden transition-shadow hover:shadow-md">
      {/* Thumbnail placeholder */}
      <div className="relative h-[110px] bg-gradient-to-br from-[var(--surface-3)] to-[var(--surface)] border-b border-[var(--border)] flex items-center justify-center overflow-hidden shrink-0">
        <Monitor className="h-10 w-10 text-[var(--border)]" aria-hidden="true" />
        {/* Status badge overlay */}
        <div className="absolute top-2.5 right-2.5">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold ${statusBadgeClass}`}>
            <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${statusDotClass}`} />
            {statusMeta.label}
          </span>
        </div>
        {/* Template label overlay */}
        <div className="absolute bottom-2 left-2.5">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)] bg-[var(--surface)]/80 backdrop-blur-sm px-1.5 py-0.5 rounded">
            {templateLabel}
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-col flex-1 p-4">
        {/* Name */}
        <h3 className="text-[0.9rem] font-semibold text-[var(--foreground)] truncate leading-snug">
          {board.name}
        </h3>

        {/* Meta row */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1 text-[0.7rem] text-[var(--text-2)]">
            <Monitor className="h-3 w-3 text-[var(--muted)]" aria-hidden="true" />
            {board.displayTheme === "LIGHT" ? "Hell" : "Dunkel"}
          </span>
          <span className="flex items-center gap-1 text-[0.7rem] text-[var(--text-2)]">
            {board.announcementEnabled ? (
              <Megaphone className="h-3 w-3 text-blue-500" aria-hidden="true" />
            ) : (
              <MegaphoneOff className="h-3 w-3 text-[var(--muted)]" aria-hidden="true" />
            )}
            {board.announcementEnabled ? "Hinweisleiste" : "Kein Hinweis"}
          </span>
        </div>

        {/* Kiosk URL */}
        <div className="mt-2.5">
          <code className="text-[0.67rem] font-mono text-[var(--muted)] bg-[var(--surface-3)] px-2 py-0.5 rounded truncate block max-w-full">
            {kioskUrl}
          </code>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="mt-3.5 flex items-center gap-2">
          <Link
            href={kioskUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="fca-button-secondary inline-flex items-center gap-1.5 text-[0.76rem] px-3 py-1.5"
          >
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            Öffnen
          </Link>
          <Link
            href={`/dashboard/infoboard/${board.id}`}
            className="fca-button-primary inline-flex items-center gap-1.5 text-[0.76rem] px-3 py-1.5"
          >
            <Settings className="h-3 w-3" aria-hidden="true" />
            Bearbeiten
          </Link>

          {/* Overflow menu */}
          <div className="relative ml-auto">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-[var(--muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)] transition-colors"
              aria-label="Mehr Optionen"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-8 z-20 min-w-[190px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-lg py-1">
                  <button
                    onClick={() => { void handleCopyUrl(); }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[0.8rem] text-[var(--foreground)] hover:bg-[var(--surface-3)]"
                  >
                    <Copy className="h-3.5 w-3.5 text-[var(--muted)]" aria-hidden="true" />
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
                    <Copy className="h-3.5 w-3.5 text-[var(--muted)]" aria-hidden="true" />
                    Duplizieren
                  </button>
                  <div className="my-1 border-t border-[var(--border)]" />
                  <button
                    onClick={async () => {
                      setMenuOpen(false);
                      await onToggleStatus(board.id, board.status);
                      router.refresh();
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[0.8rem] text-[var(--foreground)] hover:bg-[var(--surface-3)]"
                  >
                    {board.status === "ACTIVE" ? (
                      <>
                        <PowerOff className="h-3.5 w-3.5 text-[var(--muted)]" aria-hidden="true" />
                        Deaktivieren
                      </>
                    ) : (
                      <>
                        <Power className="h-3.5 w-3.5 text-[var(--muted)]" aria-hidden="true" />
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
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Löschen
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
