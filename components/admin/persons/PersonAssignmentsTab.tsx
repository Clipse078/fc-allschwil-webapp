"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Building2, Users2, Calendar, Pencil } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/page";
import type { PersonAssignment } from "@/lib/people/queries";
import { getPersonFunctionLabel, PERSON_FUNCTION_OPTIONS } from "@/lib/people/functions";

type OrgUnitOption = { id: string; name: string };
type TeamOption = { id: string; name: string; shortName?: string | null };
type SeasonOption = { id: string; name: string };

type PersonAssignmentsTabProps = {
  personId: string;
  assignments: PersonAssignment[];
  canManage: boolean;
  orgUnits: OrgUnitOption[];
  teams: TeamOption[];
  activeSeason: SeasonOption | null;
};

function AssignmentStatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE") return null;
  return (
    <span className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
      {status === "INACTIVE" ? "Inaktiv" : "Ausstehend"}
    </span>
  );
}

function AssignmentRow({
  assignment,
  canManage,
  onDelete,
  onEdit,
}: {
  assignment: PersonAssignment;
  canManage: boolean;
  onDelete: (a: PersonAssignment) => void;
  onEdit: (a: PersonAssignment) => void;
}) {
  const fn = getPersonFunctionLabel(assignment.roleKey);

  return (
    <div className="group flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition hover:bg-[var(--surface-2)]">
      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--sce-accent)] text-[var(--sce-primary)]">
        {assignment.team ? <Users2 className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            {assignment.team?.name ?? assignment.orgUnit?.name ?? "—"}
          </span>
          <span className="inline-flex items-center rounded-full bg-[var(--sce-accent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--sce-primary)]">
            {fn || assignment.roleKey || "—"}
          </span>
          <AssignmentStatusBadge status={assignment.status} />
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
          {assignment.team && assignment.orgUnit && (
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {assignment.orgUnit.name}
            </span>
          )}
          {assignment.season && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {assignment.season.name}
            </span>
          )}
          {assignment.notes && (
            <span className="truncate max-w-[200px]">{assignment.notes}</span>
          )}
        </div>
      </div>

      {canManage ? (
        <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(assignment)}
            className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]"
            title="Bearbeiten"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(assignment)}
            className="rounded-md p-1.5 text-[var(--muted)] hover:bg-red-50 hover:text-red-600"
            title="Zuordnung entfernen"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function PersonAssignmentsTab({
  personId,
  assignments: initialAssignments,
  canManage,
  orgUnits,
  teams,
  activeSeason,
}: PersonAssignmentsTabProps) {
  const router = useRouter();
  const [assignments, setAssignments] = useState<PersonAssignment[]>(initialAssignments);

  // Add assignment sheet
  const [addOpen, setAddOpen] = useState(false);
  const [addOrgUnitId, setAddOrgUnitId] = useState("");
  const [addTeamId, setAddTeamId] = useState("");
  const [addFunctionKey, setAddFunctionKey] = useState("");
  const [addSeasonId, setAddSeasonId] = useState(activeSeason?.id ?? "");
  const [addNotes, setAddNotes] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit assignment sheet
  const [editTarget, setEditTarget] = useState<PersonAssignment | null>(null);
  const [editFunctionKey, setEditFunctionKey] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirmation dialog
  const [deleteTarget, setDeleteTarget] = useState<PersonAssignment | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  function openAdd() {
    setAddOrgUnitId("");
    setAddTeamId("");
    setAddFunctionKey("");
    setAddSeasonId(activeSeason?.id ?? "");
    setAddNotes("");
    setAddError(null);
    setAddOpen(true);
  }

  function openEdit(a: PersonAssignment) {
    setEditTarget(a);
    setEditFunctionKey(a.roleKey ?? "");
    setEditNotes(a.notes ?? "");
    setEditError(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addOrgUnitId || !addFunctionKey) {
      setAddError("Organisationseinheit und Funktion sind erforderlich.");
      return;
    }
    setAddLoading(true);
    setAddError(null);
    try {
      const res = await fetch(`/api/people/${personId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgUnitId: addOrgUnitId,
          teamId: addTeamId || null,
          functionKey: addFunctionKey,
          seasonId: addSeasonId || null,
          notes: addNotes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddError(data?.error ?? "Zuordnung konnte nicht erstellt werden.");
        return;
      }
      setAddOpen(false);
      router.refresh();
      // Optimistically update
      const newAssignment = data.assignment as PersonAssignment;
      setAssignments((prev) => [...prev, newAssignment]);
    } catch {
      setAddError("Netzwerkfehler.");
    } finally {
      setAddLoading(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const res = await fetch(
        `/api/people/${personId}/assignments/${editTarget.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            functionKey: editFunctionKey || null,
            notes: editNotes.trim() || null,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditError(data?.error ?? "Fehler beim Speichern.");
        return;
      }
      setEditTarget(null);
      router.refresh();
      const updated = data.assignment as PersonAssignment;
      setAssignments((prev) =>
        prev.map((a) => (a.id === updated.id ? updated : a)),
      );
    } catch {
      setEditError("Netzwerkfehler.");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(
        `/api/people/${personId}/assignments/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        setDeleteTarget(null);
        router.refresh();
        setAssignments((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  const activeAssignments = assignments.filter((a) => a.status === "ACTIVE");
  const inactiveAssignments = assignments.filter((a) => a.status !== "ACTIVE");

  // Group by OrgUnit
  const byOrgUnit = activeAssignments.reduce<
    Record<string, { orgUnitName: string; assignments: PersonAssignment[] }>
  >((acc, a) => {
    const key = a.orgUnit?.id ?? "other";
    if (!acc[key]) {
      acc[key] = { orgUnitName: a.orgUnit?.name ?? "Sonstige", assignments: [] };
    }
    acc[key].assignments.push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
          Aktive Zuordnungen
        </h3>
        {canManage ? (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--sce-primary)] bg-transparent px-3 py-1.5 text-xs font-semibold text-[var(--sce-primary)] transition hover:bg-[var(--sce-accent)]"
          >
            <Plus className="h-3.5 w-3.5" />
            Zuordnung hinzufügen
          </button>
        ) : null}
      </div>

      {/* Active assignments grouped by OrgUnit */}
      {activeAssignments.length === 0 ? (
        <EmptyState
          icon={<Users2 className="h-8 w-8" />}
          heading="Noch keine Zuordnung"
          description="Ordne diese Person einer Organisationseinheit oder einem Team zu."
          action={
            canManage ? (
              <button
                type="button"
                onClick={openAdd}
                className="fca-button-primary"
              >
                + Zuordnung hinzufügen
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(byOrgUnit).map(([, { orgUnitName, assignments: grpAssignments }]) => (
            <div key={orgUnitName}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                {orgUnitName}
              </p>
              <div className="space-y-2">
                {grpAssignments.map((a) => (
                  <AssignmentRow
                    key={a.id}
                    assignment={a}
                    canManage={canManage}
                    onDelete={setDeleteTarget}
                    onEdit={openEdit}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inactive assignments */}
      {inactiveAssignments.length > 0 ? (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
            Frühere / Inaktive Zuordnungen
          </h3>
          <div className="space-y-2 opacity-60">
            {inactiveAssignments.map((a) => (
              <AssignmentRow
                key={a.id}
                assignment={a}
                canManage={canManage}
                onDelete={setDeleteTarget}
                onEdit={openEdit}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Add Assignment Sheet ─────────────────────────────────────── */}
      <Sheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Zuordnung hinzufügen"
        description="Person einer Organisationseinheit oder einem Team zuordnen."
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={addLoading}>
              Abbrechen
            </Button>
            <Button
              type="submit"
              form="add-assignment-form"
              loading={addLoading}
            >
              Zuordnung speichern
            </Button>
          </div>
        }
      >
        <form id="add-assignment-form" onSubmit={handleAdd} className="space-y-4 px-1">
          {addError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {addError}
            </div>
          ) : null}

          <div>
            <label className="fca-label block">Organisationseinheit *</label>
            <select
              value={addOrgUnitId}
              onChange={(e) => { setAddOrgUnitId(e.target.value); setAddTeamId(""); }}
              className="fca-input"
              required
            >
              <option value="">Bitte wählen…</option>
              {orgUnits.map((ou) => (
                <option key={ou.id} value={ou.id}>{ou.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="fca-label block">Team</label>
            <select
              value={addTeamId}
              onChange={(e) => setAddTeamId(e.target.value)}
              className="fca-input"
            >
              <option value="">Kein Team (nur OrgUnit)</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.shortName ?? t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="fca-label block">Funktion *</label>
            <select
              value={addFunctionKey}
              onChange={(e) => setAddFunctionKey(e.target.value)}
              className="fca-input"
              required
            >
              <option value="">Bitte wählen…</option>
              {PERSON_FUNCTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {activeSeason ? (
            <div>
              <label className="fca-label block">Saison</label>
              <select
                value={addSeasonId}
                onChange={(e) => setAddSeasonId(e.target.value)}
                className="fca-input"
              >
                <option value="">Keine Saison</option>
                <option value={activeSeason.id}>{activeSeason.name} (Aktiv)</option>
              </select>
            </div>
          ) : null}

          <div>
            <label className="fca-label block">Notizen</label>
            <textarea
              value={addNotes}
              onChange={(e) => setAddNotes(e.target.value)}
              rows={2}
              placeholder="Optionale Notizen zur Zuordnung…"
              maxLength={500}
              className="fca-input resize-none"
            />
          </div>
        </form>
      </Sheet>

      {/* ── Edit Assignment Sheet ─────────────────────────────────────── */}
      <Sheet
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Zuordnung bearbeiten"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={() => setEditTarget(null)} disabled={editLoading}>
              Abbrechen
            </Button>
            <Button
              type="submit"
              form="edit-assignment-form"
              loading={editLoading}
            >
              Speichern
            </Button>
          </div>
        }
      >
        <form id="edit-assignment-form" onSubmit={handleEdit} className="space-y-4 px-1">
          {editError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {editError}
            </div>
          ) : null}

          <div>
            <label className="fca-label block">Funktion</label>
            <select
              value={editFunctionKey}
              onChange={(e) => setEditFunctionKey(e.target.value)}
              className="fca-input"
            >
              <option value="">— Keine Funktion —</option>
              {PERSON_FUNCTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="fca-label block">Notizen</label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={3}
              placeholder="Optionale Notizen zur Zuordnung…"
              maxLength={500}
              className="fca-input resize-none"
            />
          </div>
        </form>
      </Sheet>

      {/* ── Delete Confirmation Dialog ────────────────────────────────── */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Zuordnung entfernen"
        description="Diese Zuordnung wird dauerhaft gelöscht. Die Person selbst wird dabei nicht gelöscht."
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>
              Abbrechen
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleteLoading}>
              Zuordnung entfernen
            </Button>
          </div>
        }
      />
    </div>
  );
}
