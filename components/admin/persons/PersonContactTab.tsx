"use client";

/**
 * PERSON-UX-10: PersonContactTab — Kontakt workspace.
 *
 * Hierarchy:
 *   Kontaktdaten
 *   Eltern / Erziehungsberechtigte
 *     → canonical GuardianRelationship list
 *     → legacy guardian fallback when no canonical relations exist
 *   Notfallkontakte
 *
 * Privacy: guardian and emergency-contact data is internal only.
 * It MUST NOT be surfaced in public APIs, website, infoboard, or mobile.
 *
 * Permissions:
 *   canViewContact   — PEOPLE_CONTACT_VIEW — display sections
 *   canManageContact — PEOPLE_CONTACT_MANAGE — mutate sections
 */

import { useState, useEffect, useCallback } from "react";
import {
  Mail,
  Phone,
  Calendar,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  ExternalLink,
  Loader2,
  AlertCircle,
  Shield,
  ArrowRight,
  Star,
} from "lucide-react";
import Link from "next/link";
import type { PersonDetail } from "@/lib/people/queries";
import { PeoplePicker, type PersonPickerResult } from "@/components/shared/PeoplePicker";

// ── Types ─────────────────────────────────────────────────────────────────────

type PersonContactTabProps = {
  person: PersonDetail;
  canManage: boolean;
  canDelete: boolean;
  canViewContact?: boolean;
  canManageContact?: boolean;
};

type GuardianRelationshipType =
  | "MOTHER"
  | "FATHER"
  | "LEGAL_GUARDIAN"
  | "FOSTER_GUARDIAN"
  | "OTHER";

const GUARDIAN_LABELS: Record<GuardianRelationshipType, string> = {
  MOTHER: "Mutter",
  FATHER: "Vater",
  LEGAL_GUARDIAN: "Erziehungsberechtigte/r",
  FOSTER_GUARDIAN: "Pflegeperson",
  OTHER: "Andere",
};

type GuardianRelationship = {
  id: string;
  relationshipType: GuardianRelationshipType;
  isPrimary: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  guardianPerson: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string | null;
    email: string | null;
    phone: string | null;
    imageUrl: string | null;
    isActive: boolean;
  };
};

type EmergencyContact = {
  id: string;
  firstName: string;
  lastName: string;
  relationship: string | null;
  phone: string;
  email: string | null;
  priority: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ContactField({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-4 py-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--muted)]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
          {label}
        </p>
        {value ? (
          href ? (
            <a
              href={href}
              className="mt-0.5 text-sm font-medium text-[var(--sce-primary)] hover:underline"
            >
              {value}
            </a>
          ) : (
            <p className="mt-0.5 text-sm font-medium text-[var(--foreground)]">
              {value}
            </p>
          )
        ) : (
          <p className="mt-0.5 text-sm italic text-[var(--muted)]">
            Nicht erfasst
          </p>
        )}
      </div>
    </div>
  );
}

function formatDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return new Date(date).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getPersonDisplayName(p: {
  firstName: string;
  lastName: string;
  displayName: string | null;
}) {
  return p.displayName || `${p.firstName} ${p.lastName}`;
}

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
        {title}
      </h3>
      {action}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-5 text-center text-sm italic text-[var(--muted)]">
      {message}
    </p>
  );
}

function ApiError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
      <AlertCircle className="h-4 w-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// ── Guardian Add Sheet ────────────────────────────────────────────────────────

function GuardianAddSheet({
  personId,
  excludeIds,
  onSuccess,
  onClose,
}: {
  personId: string;
  excludeIds: string[];
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<PersonPickerResult | null>(null);
  const [relationshipType, setRelationshipType] =
    useState<GuardianRelationshipType>("OTHER");
  const [isPrimary, setIsPrimary] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!selected) {
      setError("Bitte eine Person auswählen.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/people/${personId}/guardians`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardianPersonId: selected.id,
          relationshipType,
          isPrimary,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Fehler beim Speichern.");
        return;
      }
      onSuccess();
    } catch {
      setError("Verbindungsfehler.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            Erziehungsberechtigte Person hinzufügen
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-2)]"
            aria-label="Schliessen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Person Picker */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
              Person suchen
            </label>
            <PeoplePicker
              mode="any"
              excludeIds={[personId, ...excludeIds]}
              selected={selected}
              onSelect={setSelected}
              onClearSelected={() => setSelected(null)}
              placeholder="Name oder E-Mail eingeben…"
            />
            {!selected && (
              <p className="mt-2 text-xs text-[var(--muted)]">
                Die gesuchte Person muss bereits im Verein erfasst sein.
                Falls nicht,{" "}
                <Link
                  href="/dashboard/persons/new"
                  className="text-[var(--sce-primary)] hover:underline"
                  onClick={onClose}
                >
                  neue Person anlegen
                </Link>{" "}
                und danach diese Verknüpfung erstellen.
              </p>
            )}
          </div>

          {/* Relationship type */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
              Beziehung
            </label>
            <select
              value={relationshipType}
              onChange={(e) =>
                setRelationshipType(e.target.value as GuardianRelationshipType)
              }
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--sce-primary)] focus:outline-none"
            >
              {(
                Object.entries(GUARDIAN_LABELS) as [
                  GuardianRelationshipType,
                  string,
                ][]
              ).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Primary toggle */}
          <label className="flex cursor-pointer items-center gap-3">
            <div
              role="checkbox"
              aria-checked={isPrimary}
              onClick={() => setIsPrimary((v) => !v)}
              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition ${
                isPrimary
                  ? "border-[var(--sce-primary)] bg-[var(--sce-primary)] text-white"
                  : "border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              {isPrimary && <Check className="h-3 w-3" />}
            </div>
            <span className="text-sm text-[var(--foreground)]">
              Primärer Kontakt
            </span>
          </label>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
              Notiz (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--sce-primary)] focus:outline-none"
              placeholder="Optionale Bemerkung…"
            />
          </div>

          {error && <ApiError message={error} />}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)]"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !selected}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--sce-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Verknüpfen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Guardian Edit Sheet ───────────────────────────────────────────────────────

function GuardianEditSheet({
  personId,
  relationship,
  onSuccess,
  onClose,
}: {
  personId: string;
  relationship: GuardianRelationship;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [relationshipType, setRelationshipType] =
    useState<GuardianRelationshipType>(relationship.relationshipType);
  const [isPrimary, setIsPrimary] = useState(relationship.isPrimary);
  const [notes, setNotes] = useState(relationship.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/people/${personId}/guardians/${relationship.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            relationshipType,
            isPrimary,
            notes: notes.trim() || null,
          }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Fehler beim Speichern.");
        return;
      }
      onSuccess();
    } catch {
      setError("Verbindungsfehler.");
    } finally {
      setSaving(false);
    }
  }

  const guardianName = getPersonDisplayName(relationship.guardianPerson);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            Verknüpfung bearbeiten
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-2)]"
            aria-label="Schliessen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-sm text-[var(--muted)]">
          Beziehung zu <span className="font-medium text-[var(--foreground)]">{guardianName}</span>
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
              Beziehung
            </label>
            <select
              value={relationshipType}
              onChange={(e) =>
                setRelationshipType(e.target.value as GuardianRelationshipType)
              }
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--sce-primary)] focus:outline-none"
            >
              {(
                Object.entries(GUARDIAN_LABELS) as [
                  GuardianRelationshipType,
                  string,
                ][]
              ).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <div
              role="checkbox"
              aria-checked={isPrimary}
              onClick={() => setIsPrimary((v) => !v)}
              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition ${
                isPrimary
                  ? "border-[var(--sce-primary)] bg-[var(--sce-primary)] text-white"
                  : "border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              {isPrimary && <Check className="h-3 w-3" />}
            </div>
            <span className="text-sm text-[var(--foreground)]">
              Primärer Kontakt
            </span>
          </label>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
              Notiz (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--sce-primary)] focus:outline-none"
              placeholder="Optionale Bemerkung…"
            />
          </div>

          {error && <ApiError message={error} />}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)]"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--sce-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Guardian Remove Confirm ───────────────────────────────────────────────────

function GuardianRemoveConfirm({
  personId,
  relationship,
  onSuccess,
  onClose,
}: {
  personId: string;
  relationship: GuardianRelationship;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove() {
    setRemoving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/people/${personId}/guardians/${relationship.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Fehler beim Entfernen.");
        return;
      }
      onSuccess();
    } catch {
      setError("Verbindungsfehler.");
    } finally {
      setRemoving(false);
    }
  }

  const guardianName = getPersonDisplayName(relationship.guardianPerson);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-rose-100">
            <Trash2 className="h-5 w-5 text-rose-600" />
          </div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            Verknüpfung entfernen
          </h2>
        </div>

        <p className="mb-2 text-sm text-[var(--foreground)]">
          Die Verknüpfung zu{" "}
          <span className="font-medium">{guardianName}</span> als
          erziehungsberechtigte Person wird entfernt.
        </p>
        <p className="mb-5 text-sm text-[var(--muted)]">
          Die Person selbst bleibt im Verein erhalten.
        </p>

        {error && <ApiError message={error} />}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)]"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {removing && <Loader2 className="h-4 w-4 animate-spin" />}
            Entfernen
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Guardian Row ──────────────────────────────────────────────────────────────

function GuardianRow({
  relationship,
  canManage,
  onEdit,
  onRemove,
}: {
  personId?: string;
  relationship: GuardianRelationship;
  canManage: boolean;
  onEdit: (r: GuardianRelationship) => void;
  onRemove: (r: GuardianRelationship) => void;
}) {
  const g = relationship.guardianPerson;
  const name = getPersonDisplayName(g);
  const typeLabel = GUARDIAN_LABELS[relationship.relationshipType];

  return (
    <div className="flex items-start gap-3 py-3">
      {/* Avatar */}
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-gradient-to-br from-white to-slate-100 text-[0.65rem] font-bold uppercase tracking-wide text-[var(--sce-primary)]">
        {name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("")}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`/dashboard/persons/${g.id}`}
            className="text-sm font-semibold text-[var(--foreground)] hover:text-[var(--sce-primary)] hover:underline"
          >
            {name}
          </Link>
          {relationship.isPrimary && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              <Star className="h-2.5 w-2.5" />
              Primär
            </span>
          )}
          <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
            {typeLabel}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-3">
          {g.phone && (
            <a
              href={`tel:${g.phone}`}
              className="flex items-center gap-1 text-xs text-[var(--sce-primary)] hover:underline"
            >
              <Phone className="h-3 w-3" />
              {g.phone}
            </a>
          )}
          {g.email && (
            <a
              href={`mailto:${g.email}`}
              className="flex items-center gap-1 truncate text-xs text-[var(--muted)] hover:text-[var(--sce-primary)] hover:underline"
            >
              <Mail className="h-3 w-3" />
              <span className="truncate">{g.email}</span>
            </a>
          )}
        </div>

        {relationship.notes && (
          <p className="mt-1 text-xs italic text-[var(--muted)]">
            {relationship.notes}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-shrink-0 items-center gap-1">
        <Link
          href={`/dashboard/persons/${g.id}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          title="Person öffnen"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
        {canManage && (
          <>
            <button
              type="button"
              onClick={() => onEdit(relationship)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
              title="Bearbeiten"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onRemove(relationship)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-rose-50 hover:text-rose-600"
              title="Verknüpfung entfernen"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Emergency Contact Form Sheet ──────────────────────────────────────────────

function EmergencyContactSheet({
  personId,
  contact,
  onSuccess,
  onClose,
}: {
  personId: string;
  contact?: EmergencyContact;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const isEdit = !!contact;
  const [firstName, setFirstName] = useState(contact?.firstName ?? "");
  const [lastName, setLastName] = useState(contact?.lastName ?? "");
  const [relationship, setRelationship] = useState(
    contact?.relationship ?? "",
  );
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [priority, setPriority] = useState(contact?.priority ?? 0);
  const [notes, setNotes] = useState(contact?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!firstName.trim()) {
      setError("Vorname ist erforderlich.");
      return;
    }
    if (!lastName.trim()) {
      setError("Nachname ist erforderlich.");
      return;
    }
    if (!phone.trim()) {
      setError("Telefonnummer ist erforderlich.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      relationship: relationship.trim() || null,
      phone: phone.trim(),
      email: email.trim() || null,
      priority,
      notes: notes.trim() || null,
    };

    try {
      const url = isEdit
        ? `/api/people/${personId}/emergency-contacts/${contact!.id}`
        : `/api/people/${personId}/emergency-contacts`;
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Fehler beim Speichern.");
        return;
      }
      onSuccess();
    } catch {
      setError("Verbindungsfehler.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            {isEdit ? "Notfallkontakt bearbeiten" : "Notfallkontakt hinzufügen"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-2)]"
            aria-label="Schliessen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
                Vorname <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={100}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--sce-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
                Nachname <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                maxLength={100}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--sce-primary)] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
              Beziehung / Funktion
            </label>
            <input
              type="text"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              maxLength={100}
              placeholder="z.B. Mutter, Vater, Großelternteil…"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--sce-primary)] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
              Telefonnummer <span className="text-rose-500">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={50}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--sce-primary)] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
              E-Mail (optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--sce-primary)] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
              Priorität
            </label>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)}
              min={0}
              max={99}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--sce-primary)] focus:outline-none"
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              Niedrigere Zahl = höhere Priorität (0 = erste Wahl)
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
              Notiz (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--sce-primary)] focus:outline-none"
              placeholder="Optionale Bemerkung…"
            />
          </div>

          {error && <ApiError message={error} />}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)]"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--sce-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Speichern" : "Hinzufügen"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Emergency Contact Delete Confirm ─────────────────────────────────────────

function EmergencyContactDeleteConfirm({
  personId,
  contact,
  onSuccess,
  onClose,
}: {
  personId: string;
  contact: EmergencyContact;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/people/${personId}/emergency-contacts/${contact.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Fehler beim Löschen.");
        return;
      }
      onSuccess();
    } catch {
      setError("Verbindungsfehler.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-rose-100">
            <Trash2 className="h-5 w-5 text-rose-600" />
          </div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            Notfallkontakt löschen
          </h2>
        </div>

        <p className="mb-5 text-sm text-[var(--foreground)]">
          Soll der Eintrag{" "}
          <span className="font-medium">
            {contact.firstName} {contact.lastName}
          </span>{" "}
          endgültig gelöscht werden?
        </p>

        {error && <ApiError message={error} />}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)]"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            Löschen
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Emergency Contact Row ─────────────────────────────────────────────────────

function EmergencyContactRow({
  contact,
  canManage,
  onEdit,
  onDelete,
}: {
  contact: EmergencyContact;
  canManage: boolean;
  onEdit: (c: EmergencyContact) => void;
  onDelete: (c: EmergencyContact) => void;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      {/* Priority badge */}
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[11px] font-bold text-[var(--muted)]">
        {contact.priority + 1}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            {contact.firstName} {contact.lastName}
          </span>
          {contact.relationship && (
            <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
              {contact.relationship}
            </span>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <a
            href={`tel:${contact.phone}`}
            className="flex items-center gap-1 text-sm font-medium text-[var(--sce-primary)] hover:underline"
          >
            <Phone className="h-3.5 w-3.5" />
            {contact.phone}
          </a>
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-1 truncate text-xs text-[var(--muted)] hover:text-[var(--sce-primary)] hover:underline"
            >
              <Mail className="h-3 w-3" />
              <span className="truncate">{contact.email}</span>
            </a>
          )}
        </div>

        {contact.notes && (
          <p className="mt-1 text-xs italic text-[var(--muted)]">
            {contact.notes}
          </p>
        )}
      </div>

      {/* Actions */}
      {canManage && (
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(contact)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            title="Bearbeiten"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(contact)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-rose-50 hover:text-rose-600"
            title="Löschen"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Legacy Guardian Banner ────────────────────────────────────────────────────

function LegacyGuardianBanner({
  person,
  hasCanonicalRelations,
  canManageContact,
}: {
  person: PersonDetail;
  hasCanonicalRelations: boolean;
  canManageContact: boolean;
}) {
  const hasLegacy =
    person.guardianFirstName ||
    person.guardianLastName ||
    person.guardianEmail ||
    person.guardianPhone;

  if (!hasLegacy) return null;
  // Don't show if canonical relations already exist
  if (hasCanonicalRelations) return null;

  const legacyName = [person.guardianFirstName, person.guardianLastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-700">
        Bisherige Kontaktdaten
      </p>
      <div className="space-y-1">
        {legacyName && (
          <p className="text-sm font-medium text-amber-900">{legacyName}</p>
        )}
        {person.guardianPhone && (
          <a
            href={`tel:${person.guardianPhone}`}
            className="flex items-center gap-1.5 text-sm text-amber-700 hover:underline"
          >
            <Phone className="h-3.5 w-3.5" />
            {person.guardianPhone}
          </a>
        )}
        {person.guardianEmail && (
          <a
            href={`mailto:${person.guardianEmail}`}
            className="flex items-center gap-1.5 text-sm text-amber-700 hover:underline"
          >
            <Mail className="h-3.5 w-3.5" />
            {person.guardianEmail}
          </a>
        )}
      </div>
      {canManageContact && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-600">
          <ArrowRight className="h-3 w-3" />
          Um diese Daten zu verknüpfen, Person oben suchen und als
          Erziehungsberechtigte/r hinzufügen.
        </p>
      )}
    </div>
  );
}

// ── Guardians Section ─────────────────────────────────────────────────────────

function GuardiansSection({
  personId,
  canViewContact,
  canManageContact,
  legacyPerson,
}: {
  personId: string;
  canViewContact: boolean;
  canManageContact: boolean;
  legacyPerson: PersonDetail;
}) {
  const [relationships, setRelationships] = useState<
    GuardianRelationship[] | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [editRelationship, setEditRelationship] =
    useState<GuardianRelationship | null>(null);
  const [removeRelationship, setRemoveRelationship] =
    useState<GuardianRelationship | null>(null);

  const load = useCallback(async () => {
    if (!canViewContact) return;
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/people/${personId}/guardians`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Fehler beim Laden.");
      setRelationships(data.relationships ?? []);
    } catch (err) {
      setFetchError(
        err instanceof Error ? err.message : "Fehler beim Laden.",
      );
    } finally {
      setLoading(false);
    }
  }, [personId, canViewContact]);

  useEffect(() => {
    load();
  }, [load]);

  const existingGuardianIds = relationships?.map(
    (r) => r.guardianPerson.id,
  ) ?? [];

  const hasCanonical = (relationships?.length ?? 0) > 0;

  if (!canViewContact) {
    return (
      <div>
        <SectionHeader title="Eltern / Erziehungsberechtigte" />
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--muted)]">
          <Shield className="h-4 w-4 flex-shrink-0" />
          Keine Zugriffsberechtigung für Kontaktbeziehungen.
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Eltern / Erziehungsberechtigte"
        action={
          canManageContact ? (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--sce-primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              Hinzufügen
            </button>
          ) : null
        }
      />

      {loading && (
        <div className="flex items-center gap-2 py-4 text-sm text-[var(--muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Wird geladen…
        </div>
      )}

      {fetchError && <ApiError message={fetchError} />}

      {!loading && !fetchError && relationships !== null && (
        <>
          {relationships.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="divide-y divide-[var(--border)] px-4">
                {relationships.map((r) => (
                  <GuardianRow
                    key={r.id}
                    personId={personId}
                    relationship={r}
                    canManage={canManageContact}
                    onEdit={setEditRelationship}
                    onRemove={setRemoveRelationship}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <EmptyState message="Keine Erziehungsberechtigten hinterlegt." />
              <LegacyGuardianBanner
                person={legacyPerson}
                hasCanonicalRelations={hasCanonical}
                canManageContact={canManageContact}
              />
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showAdd && (
        <GuardianAddSheet
          personId={personId}
          excludeIds={existingGuardianIds}
          onSuccess={() => {
            setShowAdd(false);
            load();
          }}
          onClose={() => setShowAdd(false)}
        />
      )}
      {editRelationship && (
        <GuardianEditSheet
          personId={personId}
          relationship={editRelationship}
          onSuccess={() => {
            setEditRelationship(null);
            load();
          }}
          onClose={() => setEditRelationship(null)}
        />
      )}
      {removeRelationship && (
        <GuardianRemoveConfirm
          personId={personId}
          relationship={removeRelationship}
          onSuccess={() => {
            setRemoveRelationship(null);
            load();
          }}
          onClose={() => setRemoveRelationship(null)}
        />
      )}
    </div>
  );
}

// ── Emergency Contacts Section ────────────────────────────────────────────────

function EmergencyContactsSection({
  personId,
  canViewContact,
  canManageContact,
}: {
  personId: string;
  canViewContact: boolean;
  canManageContact: boolean;
}) {
  const [contacts, setContacts] = useState<EmergencyContact[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [editContact, setEditContact] = useState<EmergencyContact | null>(
    null,
  );
  const [deleteContact, setDeleteContact] = useState<EmergencyContact | null>(
    null,
  );

  const load = useCallback(async () => {
    if (!canViewContact) return;
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(
        `/api/people/${personId}/emergency-contacts`,
        { cache: "no-store" },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Fehler beim Laden.");
      setContacts(data.contacts ?? []);
    } catch (err) {
      setFetchError(
        err instanceof Error ? err.message : "Fehler beim Laden.",
      );
    } finally {
      setLoading(false);
    }
  }, [personId, canViewContact]);

  useEffect(() => {
    load();
  }, [load]);

  if (!canViewContact) {
    return (
      <div>
        <SectionHeader title="Notfallkontakte" />
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--muted)]">
          <Shield className="h-4 w-4 flex-shrink-0" />
          Keine Zugriffsberechtigung für Notfallkontakte.
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Notfallkontakte"
        action={
          canManageContact ? (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--sce-primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              Hinzufügen
            </button>
          ) : null
        }
      />

      {loading && (
        <div className="flex items-center gap-2 py-4 text-sm text-[var(--muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Wird geladen…
        </div>
      )}

      {fetchError && <ApiError message={fetchError} />}

      {!loading && !fetchError && contacts !== null && (
        <>
          {contacts.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="divide-y divide-[var(--border)] px-4">
                {contacts.map((c) => (
                  <EmergencyContactRow
                    key={c.id}
                    contact={c}
                    canManage={canManageContact}
                    onEdit={setEditContact}
                    onDelete={setDeleteContact}
                  />
                ))}
              </div>
            </div>
          ) : (
            <EmptyState message="Keine Notfallkontakte hinterlegt." />
          )}
        </>
      )}

      {/* Modals */}
      {showAdd && (
        <EmergencyContactSheet
          personId={personId}
          onSuccess={() => {
            setShowAdd(false);
            load();
          }}
          onClose={() => setShowAdd(false)}
        />
      )}
      {editContact && (
        <EmergencyContactSheet
          personId={personId}
          contact={editContact}
          onSuccess={() => {
            setEditContact(null);
            load();
          }}
          onClose={() => setEditContact(null)}
        />
      )}
      {deleteContact && (
        <EmergencyContactDeleteConfirm
          personId={personId}
          contact={deleteContact}
          onSuccess={() => {
            setDeleteContact(null);
            load();
          }}
          onClose={() => setDeleteContact(null)}
        />
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PersonContactTab({
  person,
  canViewContact = false,
  canManageContact = false,
}: PersonContactTabProps) {
  const hasAddress = person.street || person.city || person.postalCode;

  return (
    <div className="space-y-6">
      {/* ── Kontaktdaten ──────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="divide-y divide-[var(--border)] px-4">
          <ContactField
            icon={<Mail className="h-4 w-4" />}
            label="E-Mail"
            value={person.email}
            href={person.email ? `mailto:${person.email}` : undefined}
          />
          <ContactField
            icon={<Phone className="h-4 w-4" />}
            label="Telefon"
            value={person.phone}
            href={person.phone ? `tel:${person.phone}` : undefined}
          />
          <ContactField
            icon={<Calendar className="h-4 w-4" />}
            label="Geburtsdatum"
            value={formatDate(person.dateOfBirth)}
          />
        </div>
      </div>

      {/* ── Adresse ───────────────────────────────────────────────────── */}
      {hasAddress ? (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
            Adresse
          </h3>
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4">
            <div className="divide-y divide-[var(--border)]">
              {person.street ? (
                <ContactField
                  icon={<MapPin className="h-4 w-4" />}
                  label="Strasse"
                  value={`${person.street}${person.houseNumber ? " " + person.houseNumber : ""}`}
                />
              ) : null}
              {person.postalCode || person.city ? (
                <ContactField
                  icon={<MapPin className="h-4 w-4" />}
                  label="Ort"
                  value={[person.postalCode, person.city, person.country]
                    .filter(Boolean)
                    .join(" ")}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Eltern / Erziehungsberechtigte ────────────────────────────── */}
      <GuardiansSection
        personId={person.id}
        canViewContact={canViewContact}
        canManageContact={canManageContact}
        legacyPerson={person}
      />

      {/* ── Notfallkontakte ───────────────────────────────────────────── */}
      <EmergencyContactsSection
        personId={person.id}
        canViewContact={canViewContact}
        canManageContact={canManageContact}
      />
    </div>
  );
}
