"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { PeoplePicker, type PersonPickerResult } from "@/components/shared/PeoplePicker";

type RoleSummary = { id: string; key: string; name: string };
type SeasonSummary = { id: string; name: string; key: string; isActive: boolean };

type OrgMembershipPickerProps = {
  orgUnitId: string;
  existingMemberUserIds: string[];
  existingMemberPersonIds: string[];
  onAdded: () => void;
  roles: RoleSummary[];
  seasons?: SeasonSummary[];
};

type UserOption = { id: string; name: string; email: string };
type Mode = "user" | "person";

export default function OrgMembershipPicker({
  orgUnitId,
  existingMemberUserIds,
  existingMemberPersonIds,
  onAdded,
  roles,
  seasons = [],
}: OrgMembershipPickerProps) {
  const [mode, setMode] = useState<Mode>("user");

  // User mode state
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  // Person mode state (via PeoplePicker)
  const [selectedPerson, setSelectedPerson] = useState<PersonPickerResult | null>(null);

  // Shared fields
  const [roleKey, setRoleKey] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  // Phase A: season + notes
  const [seasonId, setSeasonId] = useState("");
  const [notes, setNotes] = useState("");

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load users when entering user mode
  function loadUsers() {
    if (allUsers.length > 0 || usersLoading) return;
    setUsersLoading(true);
    setUsersError(null);
    fetch("/api/users/select", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Benutzer konnten nicht geladen werden.");
        return res.json() as Promise<UserOption[]>;
      })
      .then((data) => setAllUsers(Array.isArray(data) ? data : []))
      .catch((err: unknown) => {
        setUsersError(err instanceof Error ? err.message : "Fehler beim Laden.");
      })
      .finally(() => setUsersLoading(false));
  }

  const filteredUsers = useMemo(() => {
    const q = userFilter.trim().toLowerCase();
    return allUsers.filter((u) => {
      if (existingMemberUserIds.includes(u.id)) return false;
      if (!q) return true;
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [allUsers, userFilter, existingMemberUserIds]);

  function switchMode(next: Mode) {
    setMode(next);
    setSelectedUserId("");
    setUserFilter("");
    setSelectedPerson(null);
    setRoleKey("");
    setIsPrimary(false);
    setStartsAt("");
    setEndsAt("");
    setSeasonId("");
    setNotes("");
    setSubmitError(null);
    if (next === "user") loadUsers();
  }

  function resetForm() {
    setSelectedUserId("");
    setUserFilter("");
    setSelectedPerson(null);
    setRoleKey("");
    setIsPrimary(false);
    setStartsAt("");
    setEndsAt("");
    setSeasonId("");
    setNotes("");
    setSubmitError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const userId = mode === "user" ? selectedUserId || null : null;
    const personId = mode === "person" ? selectedPerson?.id || null : null;

    if (!userId && !personId) {
      setSubmitError(
        mode === "user" ? "Bitte einen Benutzer auswählen." : "Bitte eine Person auswählen."
      );
      return;
    }

    if (mode === "user" && userId && existingMemberUserIds.includes(userId)) {
      setSubmitError("Dieser Benutzer ist bereits Mitglied.");
      return;
    }
    if (mode === "person" && personId && existingMemberPersonIds.includes(personId)) {
      setSubmitError("Diese Person ist bereits Mitglied.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/org-units/${orgUnitId}/memberships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          personId,
          roleKey: roleKey.trim() || undefined,
          isPrimary,
          startsAt: startsAt || undefined,
          endsAt: endsAt || undefined,
          seasonId: seasonId || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data?.error ?? "Fehler beim Hinzufügen.");
        return;
      }
      resetForm();
      onAdded();
    } catch {
      setSubmitError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    !submitting &&
    (mode === "user" ? !!selectedUserId : !!selectedPerson);

  const inputClass =
    "fca-input";
  const labelClass =
    "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Mode toggle */}
      <div role="group" aria-label="Mitgliedertyp auswählen" className="flex gap-2">
        <button
          type="button"
          aria-pressed={mode === "user"}
          onClick={() => switchMode("user")}
          className={`rounded-full px-4 py-1.5 text-[12px] font-semibold transition ${
            mode === "user"
              ? "text-white shadow-sm"
              : "border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-2)] hover:bg-[var(--surface-2)]"
          }`}
          style={mode === "user" ? { background: "var(--tenant-primary)" } : undefined}
        >
          App-Benutzer
        </button>
        <button
          type="button"
          aria-pressed={mode === "person"}
          onClick={() => switchMode("person")}
          className={`rounded-full px-4 py-1.5 text-[12px] font-semibold transition ${
            mode === "person"
              ? "text-white shadow-sm"
              : "border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-2)] hover:bg-[var(--surface-2)]"
          }`}
          style={mode === "person" ? { background: "var(--tenant-primary)" } : undefined}
        >
          Person
        </button>
      </div>

      {/* User mode */}
      {mode === "user" ? (
        <div className="space-y-3">
          {usersLoading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Benutzer werden geladen…
            </div>
          ) : usersError ? (
            <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {usersError}
            </div>
          ) : (
            <>
              <div>
                <label className={labelClass}>Benutzer suchen</label>
                <input
                  type="text"
                  value={userFilter}
                  onChange={(e) => {
                    setUserFilter(e.target.value);
                    setSelectedUserId("");
                  }}
                  placeholder="Name oder E-Mail filtern…"
                  className={inputClass}
                />
              </div>
              {filteredUsers.length > 0 ? (
                <div>
                  <label className={labelClass}>Benutzer auswählen</label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="fca-select"
                    size={Math.min(filteredUsers.length, 5)}
                  >
                    <option value="">— Bitte wählen —</option>
                    {filteredUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              ) : userFilter.length > 0 ? (
                <p className="text-[12px] italic text-[var(--muted)]">
                  Keine Benutzer gefunden.
                </p>
              ) : allUsers.length > 0 ? (
                <p className="text-[12px] italic text-[var(--muted)]">
                  Alle verfügbaren Benutzer sind bereits Mitglied.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {/* Person mode — PeoplePicker */}
      {mode === "person" ? (
        <div className="space-y-2">
          <label className={labelClass}>Person suchen</label>
          <PeoplePicker
            mode="any"
            excludeIds={existingMemberPersonIds}
            selected={selectedPerson}
            onSelect={setSelectedPerson}
            onClearSelected={() => setSelectedPerson(null)}
            placeholder="Name, E-Mail oder Telefon…"
          />
        </div>
      ) : null}

      {/* Optional fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Rolle (optional)</label>
          <select
            value={roleKey}
            onChange={(e) => setRoleKey(e.target.value)}
            className="fca-select"
          >
            <option value="">— Keine Rolle —</option>
            {roles.map((r) => (
              <option key={r.id} value={r.key}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3 pt-5">
          <input
            type="checkbox"
            id="isPrimary"
            checked={isPrimary}
            onChange={(e) => setIsPrimary(e.target.checked)}
            className="fca-toggle-checkbox"
          />
          <label htmlFor="isPrimary" className="text-sm font-medium text-[var(--text-2)]">
            Primäres Mitglied
          </label>
        </div>
      </div>

      {/* Date range */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Gültig ab (optional)</label>
          <input
            type="date"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Gültig bis (optional)</label>
          <input
            type="date"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* Phase A — Season picker */}
      {seasons.length > 0 ? (
        <div>
          <label className={labelClass}>Saison (optional)</label>
          <select
            value={seasonId}
            onChange={(e) => setSeasonId(e.target.value)}
            className="fca-select"
          >
            <option value="">— Keine Saison zuordnen —</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.isActive ? " (Aktiv)" : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            Ordne die Mitgliedschaft einer Saison zu, um die Saisonzugehörigkeit zu dokumentieren.
          </p>
        </div>
      ) : null}

      {/* Phase A — Notes */}
      <div>
        <label className={labelClass}>Notizen (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="z.B. Übernahme aus Vorsaison, Urlaubsvertretung…"
          rows={2}
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Submit error */}
      {submitError ? (
        <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {submitError}
        </div>
      ) : null}

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!canSubmit}
          className="fca-button-primary"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitting ? "Hinzufügen…" : "Mitglied hinzufügen"}
        </button>
      </div>
    </form>
  );
}
