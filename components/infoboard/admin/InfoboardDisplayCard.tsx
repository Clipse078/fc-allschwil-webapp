/**
 * components/infoboard/admin/InfoboardDisplayCard.tsx
 *
 * Display card for a single Infoboard screen in the administration overview.
 * Renders Display 1 (active) or Display 2 (planned/unavailable) with
 * appropriate status badges and action buttons.
 *
 * Design constraints:
 *   - Uses only established SportClubEvo dashboard design tokens.
 *   - German UI copy throughout.
 *   - No client-side state: pure presentation component.
 *   - Disabled actions render as visually inert; no dead links.
 */

import Link from "next/link";
import { ExternalLink, Monitor } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type DisplayStatus = "active" | "planned";

type DisplayCardAction = {
  readonly label: string;
  readonly href: string;
  readonly variant: "primary" | "secondary";
};

export type InfoboardDisplayCardProps = {
  /** Short label, e.g. "Display 1". */
  readonly label: string;
  /** Title of this screen, e.g. "Tagesübersicht". */
  readonly title: string;
  /** Active operational status of this display. */
  readonly status: DisplayStatus;
  /** One-line description of what this display shows. */
  readonly description: string;
  /** Public route, e.g. "/infoboard/screen-1". */
  readonly publicRoute: string;
  /**
   * Actions available for this display. When undefined, the display shows
   * a disabled "not yet available" action.
   */
  readonly actions?: readonly DisplayCardAction[];
};

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DisplayStatus }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[0.7rem] font-semibold text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Aktiv
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[0.7rem] font-semibold text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      In Vorbereitung
    </span>
  );
}

// ── InfoboardDisplayCard ──────────────────────────────────────────────────────

export function InfoboardDisplayCard({
  label,
  title,
  status,
  description,
  publicRoute,
  actions,
}: InfoboardDisplayCardProps) {
  return (
    <div className="sce-detail-section">
      <div className="sce-detail-section-header">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)]">
            <Monitor className="h-4 w-4 text-[var(--muted)]" />
          </div>
          <div className="min-w-0">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              {label}
            </p>
            <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="sce-detail-section-body space-y-4">
        <p className="text-sm text-[var(--text-2)]">{description}</p>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.72rem] text-[var(--muted)]">Route:</span>
          <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[0.72rem] text-[var(--blue)]">
            {publicRoute}
          </code>
        </div>

        {actions && actions.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                target={action.variant === "primary" ? "_blank" : undefined}
                rel={action.variant === "primary" ? "noopener noreferrer" : undefined}
                className={
                  action.variant === "primary"
                    ? "fca-button-primary inline-flex items-center gap-2"
                    : "fca-button-secondary inline-flex items-center gap-2"
                }
              >
                {action.variant === "primary" ? (
                  <ExternalLink className="h-3.5 w-3.5" />
                ) : null}
                {action.label}
              </Link>
            ))}
          </div>
        ) : (
          <div className="pt-1">
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="fca-button-secondary inline-flex cursor-not-allowed items-center gap-2 opacity-40"
            >
              Noch nicht verfügbar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
