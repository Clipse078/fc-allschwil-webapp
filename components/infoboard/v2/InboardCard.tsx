"use client";

/**
 * components/infoboard/v2/InboardCard.tsx
 *
 * Overview card for a single Infoboard with a live route preview.
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
  Power,
  PowerOff,
} from "lucide-react";
import type { InfoboardListItem } from "@/lib/infoboard/types";
import {
  STATUS_META,
  TEMPLATE_LABELS,
  infoboardKioskUrl,
} from "@/lib/infoboard/types";
import { InboardRoutePreview } from "./InboardRoutePreview";

type InboardCardProps = {
  board: InfoboardListItem;
  onDuplicate: (id: string) => Promise<void>;
  onDelete?: (id: string, name: string) => void;
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

  const statusMeta = STATUS_META[board.status] ?? {
    label: board.status,
    color: "gray",
  };
  const templateLabel = TEMPLATE_LABELS[board.templateType] ?? board.templateType;
  const kioskUrl = infoboardKioskUrl(board.slug);
  const isActive = board.status === "ACTIVE";

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
    <article className="relative flex flex-col rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden transition-shadow hover:shadow-md">
      {/* Live 16:9 preview — dominant visual element */}
      {isActive ? (
        <Link
          href={kioskUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group block shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-2"
          aria-label={`${board.name} öffnen`}
        >
          <InboardRoutePreview route={kioskUrl} title={`${board.name} Vorschau`} />
        </Link>
      ) : (
        <div
          className="relative shrink-0 flex items-center justify-center bg-[var(--surface-3)] text-[var(--muted)]"
          style={{ aspectRatio: "16 / 9" }}
          data-testid="inboard-inactive-preview"
        >
          <p className="px-4 text-center text-[0.75rem]">
            Live-Vorschau nur für aktive Infoboards verfügbar
          </p>
        </div>
      )}

      {/* Card body */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        <div className="space-y-1.5">
          <h3 className="text-[0.95rem] font-semibold text-[var(--foreground)] leading-snug">
            {board.name}
          </h3>
          <p className="text-[0.75rem] text-[var(--text-2)]">{templateLabel}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold ${statusBadgeClass}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${statusDotClass}`}
            />
            {statusMeta.label}
          </span>
          <code className="text-[0.67rem] font-mono text-[var(--muted)] bg-[var(--surface-3)] px-2 py-0.5 rounded truncate max-w-full">
            {kioskUrl}
          </code>
        </div>

        <div className="mt-auto flex items-center gap-2 pt-1">
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
                    onClick={() => {
                      void handleCopyUrl();
                    }}
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
                        <PowerOff
                          className="h-3.5 w-3.5 text-[var(--muted)]"
                          aria-hidden="true"
                        />
                        Deaktivieren
                      </>
                    ) : (
                      <>
                        <Power
                          className="h-3.5 w-3.5 text-[var(--muted)]"
                          aria-hidden="true"
                        />
                        Aktivieren
                      </>
                    )}
                  </button>
                  {onDelete && (
                    <>
                      <div className="my-1 border-t border-[var(--border)]" />
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onDelete(board.id, board.name);
                        }}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[0.8rem] text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Endgültig löschen
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
