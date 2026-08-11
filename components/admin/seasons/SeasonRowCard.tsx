"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays, Flag, Layers3, Pencil, Trash2, X } from "lucide-react";
import ActivateSeasonButton from "@/components/admin/seasons/ActivateSeasonButton";
import TeamRolloverPanel from "@/components/admin/seasons/TeamRolloverPanel";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import { Dialog } from "@/components/ui/Dialog";
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
  /** TrainingPlans linked to this Season — cascade-delete blocker. */
  trainingPlanCount: number;
  canManage: boolean;
  /** seasons.delete — gates the permanent deletion action. Deliberately
   *  separate from canManage (seasons.manage must never implicitly grant
   *  permanent deletion — ADMIN-DELETE-SEASON-01). */
  canDelete: boolean;
  /** teams.manage — gates the "Teams übernehmen" bulk rollover action. */
  canRegisterTeams: boolean;
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

/**
 * SEASON-01 — one row of the Seasons admin list. Shows name, dates, Team
 * and Event counts, and the explicit AKTUELL/VERGANGEN/ZUKÜNFTIG status
 * (derived from the persisted `Season.isActive` flag — never from dates
 * alone; see lib/seasons/status.ts#getSeasonCurrentStatus). Actions:
 * "Aktuell setzen", "Bearbeiten", "Löschen".
 *
 * ADMIN-DELETE-SEASON-01: "Löschen" requires seasons.delete (canDelete prop)
 * and is blocked when cascade-delete relations are non-zero (TeamSeason,
 * Event, TrainingPlan). A Dialog confirmation shows dependency impact and
 * requires deliberate confirmation before proceeding.
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
  trainingPlanCount,
  canManage,
  canDelete,
  canRegisterTeams,
}: SeasonRowCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // ADMIN-DELETE-SEASON-01-C1: no deps block deletion anymore.
  // TeamSeason links are removed; Events and TrainingPlans survive (seasonId → null).
  const hasAnyDeps = teamSeasonCount > 0 || eventCount > 0 || trainingPlanCount > 0;

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
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Löschen
              </button>
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

        {/* Consequence hint — shown when deps exist (informational only, never blocking) */}
        {canDelete && hasAnyDeps ? (
          <p className="mt-4 flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            Beim Löschen werden Team-Zuordnungen entfernt. Events und Trainingspläne bleiben erhalten.
          </p>
        ) : null}

        {/* ADMIN-MASTERDATA-UX-01-C2: bulk "Teams übernehmen" */}
        {!isEditing && canRegisterTeams ? (
          <TeamRolloverPanel seasonId={id} seasonName={name} />
        ) : null}

        {/* ADMIN-MASTERDATA-UX-01-C1: make the canonical Team-season
            rollover path obvious for the current Season */}
        {!isEditing && currentStatus === "AKTUELL" ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
            <p className="text-xs text-[var(--muted)]">
              Aktive Teams für diese Saison eintragen: bestehendes Team wiederverwenden und dieser Saison
              zuordnen.
            </p>
            <Link
              href="/dashboard/teams/register"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--blue)] hover:underline"
            >
              Teams für diese Saison registrieren
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ) : null}
      </div>

      {/* ADMIN-DELETE-SEASON-01: permanent deletion confirmation dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title="Saison endgültig löschen?"
        description={`Diese Aktion kann nicht rückgängig gemacht werden.`}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(false)}
              className="inline-flex h-9 items-center rounded-lg border border-[var(--border-strong)] bg-white px-4 text-sm font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)]"
            >
              Abbrechen
            </button>
            <form action={deleteSeasonAction} onSubmit={() => setDeleteDialogOpen(false)}>
              <input type="hidden" name="seasonId" value={id} />
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-lg bg-rose-600 px-4 text-sm font-medium text-white transition hover:bg-rose-700"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Endgültig löschen
              </button>
            </form>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Season identity */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
            <p className="text-xs font-medium text-[var(--muted)]">Saison</p>
            <p className="mt-0.5 font-semibold text-[var(--foreground)]">{name}</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {formatSwissDate(startDate)} – {formatSwissDate(endDate)}
            </p>
            {isActive ? (
              <p className="mt-1.5 text-xs font-medium text-emerald-600">
                Diese Saison ist aktuell als AKTUELL gesetzt. Nach der Löschung ist keine Saison mehr aktiv.
              </p>
            ) : null}
          </div>

          {/* Dependency impact — consequence-based, never blocking */}
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--foreground)]">Was passiert beim Löschen</p>
            <div className="space-y-1.5 text-sm">
              <ImpactRow
                label="Team-Zuordnungen"
                count={teamSeasonCount}
                consequence={teamSeasonCount > 0 ? "werden entfernt" : undefined}
                destructive
              />
              <ImpactRow
                label="Events / Spiele"
                count={eventCount}
                consequence={eventCount > 0 ? "bleiben erhalten, Saison-Zuordnung wird entfernt" : undefined}
              />
              <ImpactRow
                label="Trainingspläne"
                count={trainingPlanCount}
                consequence={trainingPlanCount > 0 ? "bleiben erhalten, Saison-Zuordnung wird entfernt" : undefined}
              />
            </div>
            <p className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]">
              Die Saison wird permanent gelöscht. Verknüpfte Inhalte bleiben erhalten, soweit sie eigenständige Datensätze sind.
            </p>
          </div>

          {/* Permanent deletion warning */}
          <p className="text-sm text-[var(--muted)]">
            Die Saison <strong className="text-[var(--foreground)]">{name}</strong> wird permanent aus dem System
            entfernt. Diese Aktion ist endgültig und kann nicht rückgängig gemacht werden.
          </p>
        </div>
      </Dialog>
    </div>
  );
}

function ImpactRow({
  label,
  count,
  consequence,
  destructive = false,
}: {
  label: string;
  count: number;
  consequence?: string;
  destructive?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[var(--muted)]">{label}</span>
      <span className={`text-right font-medium ${destructive && count > 0 ? "text-rose-600" : "text-[var(--foreground)]"}`}>
        {count}
        {consequence ? (
          <span className="ml-1 font-normal text-[var(--muted)]">({consequence})</span>
        ) : null}
      </span>
    </div>
  );
}
