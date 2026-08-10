"use client";

import { useState } from "react";
import { CalendarDays, Flag, Layers3, Pencil, Trash2, X } from "lucide-react";
import ActivateSeasonButton from "@/components/admin/seasons/ActivateSeasonButton";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import {
  deleteSeasonAction,
  updateSeasonDetailsAction,
} from "@/app/(admin)/dashboard/seasons/actions";
import type { SeasonCurrentStatus } from "@/lib/seasons/status";

export type SeasonRowCardProps = {
  id: string;
  seasonKey: string;
  name: string;
  isActive: boolean;
  startDate: string | Date;
  endDate: string | Date;
  currentStatus: SeasonCurrentStatus;
  currentStatusLabel: string;
  teamSeasonCount: number;
  eventCount: number;
  canManage: boolean;
};

function toDateInputValue(value: string | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatSwissDate(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("de-CH", { timeZone: "UTC" });
}

function statusTone(status: SeasonCurrentStatus): "success" | "muted" | "warning" {
  if (status === "AKTUELL") return "success";
  if (status === "VERGANGEN") return "muted";
  return "warning";
}

const canDeleteHint = "Löschen nicht möglich: Saison wird noch referenziert (Teams, Events o.ä.).";

/**
 * SEASON-01 — one row of the Seasons admin list. Shows name, dates, Team
 * and Event counts, and the explicit AKTUELL/VERGANGEN/ZUKÜNFTIG status
 * (derived from the persisted `Season.isActive` flag — never from dates
 * alone; see lib/seasons/status.ts#getSeasonCurrentStatus). Actions:
 * "Aktuell setzen", "Bearbeiten", "Löschen".
 */
export default function SeasonRowCard({
  id,
  seasonKey,
  name,
  isActive,
  startDate,
  endDate,
  currentStatus,
  currentStatusLabel,
  teamSeasonCount,
  eventCount,
  canManage,
}: SeasonRowCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const canDelete = teamSeasonCount === 0 && eventCount === 0;

  return (
    <div className="sce-detail-section">
      <div className="sce-detail-section-header">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-white">
            <CalendarDays className="h-4 w-4 text-[var(--blue)]" />
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[var(--foreground)]">{name}</span>
            <code className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0 text-[0.65rem] font-mono text-[var(--muted)]">
              {seasonKey}
            </code>
            <AdminStatusPill label={currentStatusLabel} tone={statusTone(currentStatus)} />
          </div>
        </div>

        {canManage ? (
          <div className="flex shrink-0 items-center gap-2">
            <ActivateSeasonButton seasonId={id} seasonName={name} isActive={isActive} />
            <button
              type="button"
              onClick={() => setIsEditing((prev) => !prev)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-white px-3 text-xs font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)]"
            >
              {isEditing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
              {isEditing ? "Abbrechen" : "Bearbeiten"}
            </button>
            {canDelete ? (
              <form action={deleteSeasonAction}>
                <input type="hidden" name="seasonId" value={id} />
                <button
                  type="submit"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Löschen
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="sce-detail-section-body">
        {isEditing ? (
          <form
            action={updateSeasonDetailsAction}
            className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
          >
            <input type="hidden" name="seasonId" value={id} />
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]" htmlFor={`name-${id}`}>
                Name
              </label>
              <input id={`name-${id}`} name="name" defaultValue={name} className="fca-input w-full" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]" htmlFor={`start-${id}`}>
                Startdatum
              </label>
              <input
                id={`start-${id}`}
                name="startDate"
                type="date"
                defaultValue={toDateInputValue(startDate)}
                className="fca-input w-full"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]" htmlFor={`end-${id}`}>
                Enddatum
              </label>
              <input
                id={`end-${id}`}
                name="endDate"
                type="date"
                defaultValue={toDateInputValue(endDate)}
                className="fca-input w-full"
                required
              />
            </div>
            <button type="submit" className="fca-button-primary">
              Speichern
            </button>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <div className="sce-data-field">
              <p className="sce-data-label">Zeitraum</p>
              <p className="sce-data-value mt-1.5 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[var(--blue)]" />
                {formatSwissDate(startDate)} – {formatSwissDate(endDate)}
              </p>
            </div>

            <div className="sce-data-field">
              <p className="sce-data-label">Teams</p>
              <div className="mt-1.5 flex items-center gap-2">
                <Layers3 className="h-3.5 w-3.5 shrink-0 text-[var(--blue)]" />
                <span className="sce-data-value">{teamSeasonCount}</span>
              </div>
            </div>

            <div className="sce-data-field">
              <p className="sce-data-label">Events</p>
              <div className="mt-1.5 flex items-center gap-2">
                <Flag className="h-3.5 w-3.5 shrink-0 text-[var(--blue)]" />
                <span className="sce-data-value">{eventCount}</span>
              </div>
            </div>

            <div className="sce-data-field">
              <p className="sce-data-label">Status</p>
              <p className="sce-data-value mt-1.5">{currentStatusLabel}</p>
            </div>
          </div>
        )}

        {!canDelete ? <p className="mt-4 text-xs text-[var(--muted)]">{canDeleteHint}</p> : null}
      </div>
    </div>
  );
}
