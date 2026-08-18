"use client";

/**
 * PERSON-UX-04: PersonMembershipTab — Club membership lifecycle UI.
 *
 * Replaces the former Mitgliedschaft placeholder with a real component.
 *
 * Sections:
 *   A) CURRENT MEMBERSHIP — shows the most recent ACTIVE/INACTIVE record prominently.
 *   B) HISTORY            — all records, newest first; current vs historical is clear.
 *   C) MANAGEMENT         — authorized managers can create / edit / end memberships.
 *
 * Authorization: canManage is pre-resolved server-side (people.manage equivalent).
 * This component performs NO authorization checks — it only uses the passed boolean.
 *
 * INVARIANTS (enforced by the API, not here):
 *   - Ending a membership does NOT deactivate the Person.
 *   - ENDED records are permanent — no delete.
 *   - Club membership is independent of User, TenantMembership, assignments, squads.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, CheckCircle2, XCircle, CircleDot, CreditCard } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/page";
import type { PersonMembershipRecord } from "@/lib/people/queries";
import { PersonMembershipStatus, PersonMembershipType } from "@prisma/client";

// ── Labels ────────────────────────────────────────────────────────────────────

const MEMBERSHIP_TYPE_LABELS: Record<PersonMembershipType, string> = {
  ACTIVE_MEMBER: "Aktivmitglied",
  PASSIVE_MEMBER: "Passivmitglied",
  HONORARY_MEMBER: "Ehrenmitglied",
  OTHER: "Sonstige",
};

const MEMBERSHIP_TYPE_OPTIONS = Object.entries(MEMBERSHIP_TYPE_LABELS).map(
  ([value, label]) => ({ value: value as PersonMembershipType, label }),
);

const MEMBERSHIP_STATUS_LABELS: Record<PersonMembershipStatus, string> = {
  ACTIVE: "Aktiv",
  INACTIVE: "Inaktiv",
  ENDED: "Beendet",
};

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ── Status badge ──────────────────────────────────────────────────────────────

function MembershipStatusBadge({ status }: { status: PersonMembershipStatus }) {
  if (status === PersonMembershipStatus.ACTIVE) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--sce-accent)] px-2.5 py-0.5 text-xs font-semibold text-[var(--sce-primary)]">
        <CheckCircle2 className="h-3 w-3" />
        {MEMBERSHIP_STATUS_LABELS[status]}
      </span>
    );
  }
  if (status === PersonMembershipStatus.ENDED) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-3)] px-2.5 py-0.5 text-xs font-medium text-[var(--muted)]">
        <XCircle className="h-3 w-3" />
        {MEMBERSHIP_STATUS_LABELS[status]}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-3)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-2)]">
      <CircleDot className="h-3 w-3" />
      {MEMBERSHIP_STATUS_LABELS[status]}
    </span>
  );
}

// ── Membership row ────────────────────────────────────────────────────────────

function MembershipRow({
  membership,
  canManage,
  onEdit,
  onEnd,
  isCurrent,
}: {
  membership: PersonMembershipRecord;
  canManage: boolean;
  onEdit: (m: PersonMembershipRecord) => void;
  onEnd: (m: PersonMembershipRecord) => void;
  isCurrent: boolean;
}) {
  return (
    <div
      className={`group flex items-start gap-3 rounded-xl border px-4 py-3 transition ${
        isCurrent
          ? "border-[var(--sce-primary)] bg-[var(--sce-accent)]"
          : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
      }`}
    >
      <div
        className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
          isCurrent ? "bg-[var(--sce-primary)] text-white" : "bg-[var(--surface-3)] text-[var(--muted)]"
        }`}
      >
        <CreditCard className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            {MEMBERSHIP_TYPE_LABELS[membership.membershipType]}
          </span>
          <MembershipStatusBadge status={membership.status} />
          {membership.memberNumber ? (
            <span className="text-xs text-[var(--muted)]">Nr. {membership.memberNumber}</span>
          ) : null}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
          <span>
            Mitglied seit: <span className="text-[var(--text-2)]">{formatDate(membership.startsAt)}</span>
          </span>
          {membership.endsAt ? (
            <span>
              Austritt: <span className="text-[var(--text-2)]">{formatDate(membership.endsAt)}</span>
            </span>
          ) : null}
          {membership.notes ? (
            <span className="max-w-[280px] truncate">{membership.notes}</span>
          ) : null}
        </div>
      </div>

      {canManage && membership.status !== PersonMembershipStatus.ENDED ? (
        <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            title="Bearbeiten"
            onClick={() => onEdit(membership)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Mitgliedschaft beenden"
            onClick={() => onEnd(membership)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-3)] hover:text-[var(--sce-danger)]"
          >
            <XCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ── Create / Edit form dialog ─────────────────────────────────────────────────

type MembershipFormValues = {
  membershipType: PersonMembershipType;
  memberNumber: string;
  startsAt: string;
  endsAt: string;
  notes: string;
};

function MembershipFormDialog({
  open,
  onClose,
  title,
  initialValues,
  onSubmit,
  submitting,
  submitError,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  initialValues: MembershipFormValues;
  onSubmit: (values: MembershipFormValues) => void;
  submitting: boolean;
  submitError: string | null;
}) {
  const [values, setValues] = useState<MembershipFormValues>(initialValues);

  // Reset form when dialog opens
  const handleOpen = () => {
    setValues(initialValues);
  };

  const set = (key: keyof MembershipFormValues) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setValues((v) => ({ ...v, [key]: e.target.value }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
            Abbrechen
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onSubmit(values)}
            disabled={submitting}
          >
            {submitting ? "Speichern…" : "Speichern"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4" onFocus={handleOpen}>
        {submitError ? (
          <p className="rounded-lg bg-[var(--sce-danger-bg,#fee2e2)] px-3 py-2 text-sm text-[var(--sce-danger)]">
            {submitError}
          </p>
        ) : null}

        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--text-2)]">
            Mitgliedschaftstyp
          </label>
          <select
            value={values.membershipType}
            onChange={set("membershipType")}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--sce-primary)]"
          >
            {MEMBERSHIP_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--text-2)]">
            Mitgliedsnummer <span className="font-normal text-[var(--muted)]">(optional)</span>
          </label>
          <input
            type="text"
            value={values.memberNumber}
            onChange={set("memberNumber")}
            placeholder="z.B. 12345"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--sce-primary)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-2)]">
              Eintrittsdatum <span className="text-[var(--sce-danger)]">*</span>
            </label>
            <input
              type="date"
              value={values.startsAt}
              onChange={set("startsAt")}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--sce-primary)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-2)]">
              Austrittsdatum <span className="font-normal text-[var(--muted)]">(optional)</span>
            </label>
            <input
              type="date"
              value={values.endsAt}
              onChange={set("endsAt")}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--sce-primary)]"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--text-2)]">
            Notizen <span className="font-normal text-[var(--muted)]">(optional)</span>
          </label>
          <textarea
            value={values.notes}
            onChange={set("notes")}
            rows={2}
            placeholder="Interne Notizen zur Mitgliedschaft"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--sce-primary)]"
          />
        </div>
      </div>
    </Dialog>
  );
}

// ── End membership dialog ─────────────────────────────────────────────────────

function EndMembershipDialog({
  open,
  onClose,
  membership,
  onConfirm,
  submitting,
  submitError,
}: {
  open: boolean;
  onClose: () => void;
  membership: PersonMembershipRecord | null;
  onConfirm: (endsAt: string) => void;
  submitting: boolean;
  submitError: string | null;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [endsAt, setEndsAt] = useState(today);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Mitgliedschaft beenden"
      description="Die Mitgliedschaft wird als beendet markiert. Der Datensatz bleibt permanent erhalten."
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
            Abbrechen
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onConfirm(endsAt)}
            disabled={submitting || !endsAt}
          >
            {submitting ? "Beenden…" : "Mitgliedschaft beenden"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {submitError ? (
          <p className="rounded-lg bg-[var(--sce-danger-bg,#fee2e2)] px-3 py-2 text-sm text-[var(--sce-danger)]">
            {submitError}
          </p>
        ) : null}

        {membership ? (
          <p className="text-sm text-[var(--text-2)]">
            <span className="font-semibold">{MEMBERSHIP_TYPE_LABELS[membership.membershipType]}</span>
            {" — Mitglied seit "}
            <span className="font-semibold">{formatDate(membership.startsAt)}</span>
          </p>
        ) : null}

        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--text-2)]">
            Austrittsdatum <span className="text-[var(--sce-danger)]">*</span>
          </label>
          <input
            type="date"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--sce-primary)]"
          />
        </div>
      </div>
    </Dialog>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type PersonMembershipTabProps = {
  personId: string;
  memberships: PersonMembershipRecord[];
  canManage: boolean;
};

const EMPTY_FORM: MembershipFormValues = {
  membershipType: PersonMembershipType.ACTIVE_MEMBER,
  memberNumber: "",
  startsAt: new Date().toISOString().split("T")[0],
  endsAt: "",
  notes: "",
};

export default function PersonMembershipTab({
  personId,
  memberships: initialMemberships,
  canManage,
}: PersonMembershipTabProps) {
  const router = useRouter();
  const [memberships, setMemberships] = useState<PersonMembershipRecord[]>(initialMemberships);

  // ── Dialog state ─────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PersonMembershipRecord | null>(null);
  const [endTarget, setEndTarget] = useState<PersonMembershipRecord | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Current vs historical ─────────────────────────────────────────────────
  const currentMembership = memberships.find(
    (m) =>
      m.status === PersonMembershipStatus.ACTIVE ||
      m.status === PersonMembershipStatus.INACTIVE,
  ) ?? null;
  const historicalMemberships = memberships.filter(
    (m) => m.status === PersonMembershipStatus.ENDED,
  );

  // ── Create ────────────────────────────────────────────────────────────────
  async function handleCreate(values: MembershipFormValues) {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/people/${personId}/memberships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipType: values.membershipType,
          memberNumber: values.memberNumber || null,
          startsAt: values.startsAt,
          endsAt: values.endsAt || null,
          notes: values.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Fehler beim Erstellen.");
        return;
      }
      setMemberships((prev) =>
        [data.membership, ...prev].sort(
          (a, b) =>
            new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
        ),
      );
      setCreateOpen(false);
      router.refresh();
    } catch {
      setSubmitError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────
  async function handleUpdate(values: MembershipFormValues) {
    if (!editTarget) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/people/${personId}/memberships/${editTarget.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            membershipType: values.membershipType,
            memberNumber: values.memberNumber || null,
            startsAt: values.startsAt,
            endsAt: values.endsAt || null,
            notes: values.notes || null,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Fehler beim Speichern.");
        return;
      }
      setMemberships((prev) =>
        prev
          .map((m) => (m.id === editTarget.id ? data.membership : m))
          .sort(
            (a, b) =>
              new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
          ),
      );
      setEditTarget(null);
      router.refresh();
    } catch {
      setSubmitError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── End ───────────────────────────────────────────────────────────────────
  async function handleEnd(endsAt: string) {
    if (!endTarget) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/people/${personId}/memberships/${endTarget.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "end", endsAt }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Fehler beim Beenden.");
        return;
      }
      setMemberships((prev) =>
        prev
          .map((m) => (m.id === endTarget.id ? data.membership : m))
          .sort(
            (a, b) =>
              new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
          ),
      );
      setEndTarget(null);
      router.refresh();
    } catch {
      setSubmitError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(m: PersonMembershipRecord) {
    setSubmitError(null);
    setEditTarget(m);
  }

  function openEnd(m: PersonMembershipRecord) {
    setSubmitError(null);
    setEndTarget(m);
  }

  const editFormValues: MembershipFormValues = editTarget
    ? {
        membershipType: editTarget.membershipType,
        memberNumber: editTarget.memberNumber ?? "",
        startsAt: new Date(editTarget.startsAt).toISOString().split("T")[0],
        endsAt: editTarget.endsAt
          ? new Date(editTarget.endsAt).toISOString().split("T")[0]
          : "",
        notes: editTarget.notes ?? "",
      }
    : EMPTY_FORM;

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[var(--foreground)]">Mitgliedschaft</h3>
          <p className="text-sm text-[var(--muted)]">Vereinsmitgliedschaft und -verlauf</p>
        </div>
        {canManage ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => { setSubmitError(null); setCreateOpen(true); }}
          >
            <Plus className="h-3.5 w-3.5" />
            Mitgliedschaft erfassen
          </Button>
        ) : null}
      </div>

      {/* Empty state — no memberships at all */}
      {memberships.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-8 w-8" />}
          heading="Keine Mitgliedschaft"
          description={
            canManage
              ? "Diese Person ist noch kein Vereinsmitglied. Mitgliedschaft erfassen, um die Geschichte zu beginnen."
              : "Diese Person hat keine Vereinsmitgliedschaft. Externe Personen (Sponsoren, Kontakte) können ohne Mitgliedschaft existieren."
          }
          action={
            canManage ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => { setSubmitError(null); setCreateOpen(true); }}
              >
                <Plus className="h-3.5 w-3.5" />
                Mitgliedschaft erfassen
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {/* A) Current membership */}
          {currentMembership ? (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                Aktuelle Mitgliedschaft
              </p>
              <MembershipRow
                membership={currentMembership}
                canManage={canManage}
                onEdit={openEdit}
                onEnd={openEnd}
                isCurrent
              />
            </section>
          ) : null}

          {/* B) History */}
          {historicalMemberships.length > 0 ? (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                Mitgliedschaftsverlauf
              </p>
              <div className="space-y-2">
                {historicalMemberships.map((m) => (
                  <MembershipRow
                    key={m.id}
                    membership={m}
                    canManage={canManage}
                    onEdit={openEdit}
                    onEnd={openEnd}
                    isCurrent={false}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      {/* Create dialog */}
      <MembershipFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Mitgliedschaft erfassen"
        initialValues={EMPTY_FORM}
        onSubmit={handleCreate}
        submitting={submitting}
        submitError={submitError}
      />

      {/* Edit dialog */}
      <MembershipFormDialog
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Mitgliedschaft bearbeiten"
        initialValues={editFormValues}
        onSubmit={handleUpdate}
        submitting={submitting}
        submitError={submitError}
      />

      {/* End dialog */}
      <EndMembershipDialog
        open={!!endTarget}
        onClose={() => setEndTarget(null)}
        membership={endTarget}
        onConfirm={handleEnd}
        submitting={submitting}
        submitError={submitError}
      />
    </div>
  );
}
