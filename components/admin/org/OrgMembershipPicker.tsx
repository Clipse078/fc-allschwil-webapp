"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

type OrgMembershipPickerProps = {
  orgUnitId: string;
  existingMemberUserIds: string[];
  existingMemberPersonIds: string[];
  onAdded: () => void;
};

type UserOption = { id: string; name: string; email: string };

type PersonSearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
};

type Mode = "user" | "person";

function getPersonLabel(p: PersonSearchResult) {
  return p.displayName || `${p.firstName} ${p.lastName}`;
}

export default function OrgMembershipPicker({
  orgUnitId,
  existingMemberUserIds,
  existingMemberPersonIds,
  onAdded,
}: OrgMembershipPickerProps) {
  const [mode, setMode] = useState<Mode>("user");

  // User mode state
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  // Person mode state
  const [personQuery, setPersonQuery] = useState("");
  const [personSearchLoading, setPersonSearchLoading] = useState(false);
  const [personSearchError, setPersonSearchError] = useState<string | null>(null);
  const [personResults, setPersonResults] = useState<PersonSearchResult[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState("");

  // Shared fields
  const [roleKey, setRoleKey] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load users when entering user mode
  useEffect(() => {
    if (mode !== "user") return;
    if (allUsers.length > 0) return;

    setUsersLoading(true);
    setUsersError(null);

    fetch("/api/users/select", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Benutzer konnten nicht geladen werden.");
        return res.json() as Promise<UserOption[]>;
      })
      .then((data) => {
        setAllUsers(Array.isArray(data) ? data : []);
      })
      .catch((err: unknown) => {
        setUsersError(
          err instanceof Error ? err.message : "Fehler beim Laden der Benutzer."
        );
      })
      .finally(() => setUsersLoading(false));
  }, [mode, allUsers.length]);

  const filteredUsers = useMemo(() => {
    const q = userFilter.trim().toLowerCase();
    return allUsers.filter((u) => {
      if (existingMemberUserIds.includes(u.id)) return false;
      if (!q) return true;
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [allUsers, userFilter, existingMemberUserIds]);

  async function handlePersonSearch() {
    const q = personQuery.trim();
    if (q.length < 2) {
      setPersonSearchError("Bitte mindestens 2 Zeichen eingeben.");
      setPersonResults([]);
      setSelectedPersonId("");
      return;
    }

    setPersonSearchLoading(true);
    setPersonSearchError(null);

    try {
      const res = await fetch(
        `/api/people/search?q=${encodeURIComponent(q)}&mode=any`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Personensuche fehlgeschlagen.");
      const results = (Array.isArray(data) ? data : []) as PersonSearchResult[];
      const filtered = results.filter(
        (p) => !existingMemberPersonIds.includes(p.id)
      );
      setPersonResults(filtered);
      setSelectedPersonId(filtered[0]?.id ?? "");
    } catch (err: unknown) {
      setPersonSearchError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      );
      setPersonResults([]);
      setSelectedPersonId("");
    } finally {
      setPersonSearchLoading(false);
    }
  }

  function isDuplicate() {
    if (mode === "user" && selectedUserId) {
      return existingMemberUserIds.includes(selectedUserId);
    }
    if (mode === "person" && selectedPersonId) {
      return existingMemberPersonIds.includes(selectedPersonId);
    }
    return false;
  }

  function resetForm() {
    setSelectedUserId("");
    setUserFilter("");
    setPersonQuery("");
    setPersonResults([]);
    setSelectedPersonId("");
    setRoleKey("");
    setIsPrimary(false);
    setSubmitError(null);
  }

  function switchMode(next: Mode) {
    setMode(next);
    resetForm();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (isDuplicate()) {
      setSubmitError("Diese Person ist bereits Mitglied.");
      return;
    }

    const userId = mode === "user" ? selectedUserId || null : null;
    const personId = mode === "person" ? selectedPersonId || null : null;

    if (!userId && !personId) {
      setSubmitError(
        mode === "user"
          ? "Bitte einen Benutzer auswählen."
          : "Bitte eine Person auswählen."
      );
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

  const inputClass =
    "w-full rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0b4aa2]/30";
  const labelClass =
    "block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-1.5";

  const canSubmit =
    !submitting &&
    (mode === "user" ? !!selectedUserId : !!selectedPersonId) &&
    !isDuplicate();

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
              ? "bg-[#0b4aa2] text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          App-Benutzer
        </button>
        <button
          type="button"
          aria-pressed={mode === "person"}
          onClick={() => switchMode("person")}
          className={`rounded-full px-4 py-1.5 text-[12px] font-semibold transition ${
            mode === "person"
              ? "bg-[#0b4aa2] text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          Person
        </button>
      </div>

      {/* User mode */}
      {mode === "user" ? (
        <div className="space-y-3">
          {usersLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Benutzer werden geladen…
            </div>
          ) : usersError ? (
            <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
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
                    className={inputClass}
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
                <p className="text-[12px] italic text-slate-400">
                  Keine Benutzer gefunden.
                </p>
              ) : allUsers.length > 0 ? (
                <p className="text-[12px] italic text-slate-400">
                  Alle verfügbaren Benutzer sind bereits Mitglied dieser Einheit.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {/* Person mode */}
      {mode === "person" ? (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Person suchen</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={personQuery}
                onChange={(e) => setPersonQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handlePersonSearch();
                  }
                }}
                placeholder="Name, E-Mail oder Telefon…"
                className={inputClass}
              />
              <button
                type="button"
                onClick={handlePersonSearch}
                disabled={personSearchLoading}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-[#08357a]"
              >
                {personSearchLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {personSearchLoading ? "Suche…" : "Suchen"}
              </button>
            </div>
          </div>
          {personSearchError ? (
            <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {personSearchError}
            </div>
          ) : null}
          {personResults.length > 0 ? (
            <div>
              <label className={labelClass}>Person auswählen</label>
              <select
                value={selectedPersonId}
                onChange={(e) => setSelectedPersonId(e.target.value)}
                className={inputClass}
                size={Math.min(personResults.length, 5)}
              >
                {personResults.map((p) => (
                  <option key={p.id} value={p.id}>
                    {getPersonLabel(p)}
                    {p.email ? ` (${p.email})` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Duplicate warning */}
      {isDuplicate() ? (
        <div className="rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          Diese Person ist bereits Mitglied.
        </div>
      ) : null}

      {/* Optional fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Rolle (optional)</label>
          <input
            type="text"
            value={roleKey}
            onChange={(e) => setRoleKey(e.target.value)}
            placeholder="z.B. Kassier, Präsident…"
            className={inputClass}
          />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <input
            type="checkbox"
            id="isPrimary"
            checked={isPrimary}
            onChange={(e) => setIsPrimary(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 accent-[#0b4aa2]"
          />
          <label htmlFor="isPrimary" className="text-sm font-medium text-slate-700">
            Primäres Mitglied
          </label>
        </div>
      </div>

      {/* Submit error */}
      {submitError ? (
        <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {submitError}
        </div>
      ) : null}

      {/* Submit button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[#08357a]"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitting ? "Hinzufügen…" : "Mitglied hinzufügen"}
        </button>
      </div>
    </form>
  );
}
