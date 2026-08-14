"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, UserPlus } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { PERSON_FUNCTION_OPTIONS } from "@/lib/people/functions";

type OrgUnitOption = { id: string; name: string };
type TeamOption = {
  id: string;
  name: string;
  shortName?: string | null;
  orgUnitIds?: string[];
};
type SeasonOption = { id: string; name: string };

type DuplicateCandidate = { id: string; name: string; email: string | null };

type PersonCreateSheetProps = {
  open: boolean;
  onClose: () => void;
  orgUnits: OrgUnitOption[];
  teams: TeamOption[];
  activeSeason: SeasonOption | null;
};

export default function PersonCreateSheet({
  open,
  onClose,
  orgUnits,
  teams,
  activeSeason,
}: PersonCreateSheetProps) {
  const router = useRouter();

  // Person identity
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [notes, setNotes] = useState("");

  // Assignment
  const [addAssignment, setAddAssignment] = useState(false);
  const [orgUnitId, setOrgUnitId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [functionKey, setFunctionKey] = useState("");
  const [seasonId, setSeasonId] = useState(activeSeason?.id ?? "");

  // Duplicate awareness
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicateCheckDone, setDuplicateCheckDone] = useState(false);

  // Form state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setDateOfBirth("");
      setNotes("");
      setAddAssignment(false);
      setOrgUnitId("");
      setTeamId("");
      setFunctionKey("");
      setSeasonId(activeSeason?.id ?? "");
      setDuplicates([]);
      setDuplicateCheckDone(false);
      setError(null);
    }
  }, [open, activeSeason?.id]);

  // Filter teams by selected orgUnit
  const filteredTeams = orgUnitId
    ? teams.filter(
        (t) =>
          !t.orgUnitIds?.length || t.orgUnitIds.includes(orgUnitId),
      )
    : teams;

  // Check duplicates (debounced-ish, triggered on name/email blur)
  const checkDuplicates = useCallback(async () => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn || !ln) return;

    setCheckingDuplicates(true);
    try {
      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          __checkDuplicates: true,
          firstName: fn,
          lastName: ln,
          email: email.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setDuplicates(data.duplicates ?? []);
      setDuplicateCheckDone(true);
    } catch {
      // Silent — duplicate check is advisory
    } finally {
      setCheckingDuplicates(false);
    }
  }, [firstName, lastName, email]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn) { setError("Vorname ist erforderlich."); return; }
    if (!ln) { setError("Nachname ist erforderlich."); return; }
    if (addAssignment && !orgUnitId) { setError("Organisationseinheit ist erforderlich."); return; }
    if (addAssignment && !functionKey) { setError("Funktion ist erforderlich."); return; }

    setLoading(true);
    try {
      // 1. Create person
      const createRes = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: fn,
          lastName: ln,
          email: email.trim() || null,
          phone: phone.trim() || null,
          dateOfBirth: dateOfBirth || null,
          notes: notes.trim() || null,
        }),
      });
      const createData = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        setError(createData?.error ?? "Person konnte nicht erstellt werden.");
        return;
      }

      const personId: string = createData.person.id;

      // 2. Create initial assignment if requested
      if (addAssignment && orgUnitId && functionKey) {
        const assignRes = await fetch(`/api/people/${personId}/assignments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgUnitId,
            teamId: teamId || null,
            functionKey,
            seasonId: seasonId || null,
          }),
        });
        if (!assignRes.ok) {
          // Person was created; navigate anyway but warn
          console.warn("Initial assignment failed");
        }
      }

      router.push(`/dashboard/persons/${personId}`);
      router.refresh();
      onClose();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Person hinzufügen"
      description="Neuen Personendatensatz im Verein anlegen."
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" type="button" onClick={onClose} disabled={loading}>
            Abbrechen
          </Button>
          <Button
            type="submit"
            form="person-create-form"
            loading={loading}
          >
            <UserPlus className="h-4 w-4" />
            Person erstellen
          </Button>
        </div>
      }
    >
      <form id="person-create-form" onSubmit={handleSubmit} className="space-y-6 px-1">
        {/* Error */}
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {/* Identity */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
            Stammdaten
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="fca-label block">Vorname *</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setDuplicateCheckDone(false); }}
                onBlur={checkDuplicates}
                placeholder="Vorname"
                maxLength={100}
                className="fca-input"
                required
              />
            </div>
            <div>
              <label className="fca-label block">Nachname *</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); setDuplicateCheckDone(false); }}
                onBlur={checkDuplicates}
                placeholder="Nachname"
                maxLength={100}
                className="fca-input"
                required
              />
            </div>
          </div>
        </div>

        {/* Duplicate warning */}
        {duplicateCheckDone && duplicates.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-800">
                  Mögliche Duplikate gefunden
                </p>
                <p className="mt-0.5 text-xs text-amber-700">
                  Folgende Personen haben denselben Namen oder dieselbe E-Mail. Prüfe, ob diese Person bereits erfasst ist.
                </p>
                <ul className="mt-2 space-y-1">
                  {duplicates.map((d) => (
                    <li key={d.id}>
                      <a
                        href={`/dashboard/persons/${d.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-amber-800 hover:underline"
                      >
                        {d.name}
                        {d.email ? ` · ${d.email}` : ""}
                        {" ↗"}
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-amber-600">
                  Du kannst trotzdem fortfahren, wenn es sich um eine andere Person handelt.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Contact */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
            Kontakt
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="fca-label block">E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setDuplicateCheckDone(false); }}
                onBlur={checkDuplicates}
                placeholder="name@example.com"
                maxLength={200}
                className="fca-input"
              />
            </div>
            <div>
              <label className="fca-label block">Telefon</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+41 79 000 00 00"
                maxLength={50}
                className="fca-input"
              />
            </div>
            <div>
              <label className="fca-label block">Geburtsdatum</label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="fca-input"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="fca-label block">Notizen</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Optionale interne Notizen…"
            maxLength={1000}
            className="fca-input resize-none"
          />
        </div>

        {/* Assignment toggle */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Zuordnung hinzufügen
              </p>
              <p className="text-xs text-[var(--muted)]">
                Person direkt einer Organisationseinheit oder einem Team zuordnen.
              </p>
            </div>
            <input
              type="checkbox"
              checked={addAssignment}
              onChange={(e) => setAddAssignment(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border)] accent-[var(--sce-primary)]"
            />
          </label>

          {addAssignment ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="fca-label block">Organisationseinheit *</label>
                <select
                  value={orgUnitId}
                  onChange={(e) => { setOrgUnitId(e.target.value); setTeamId(""); }}
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
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="fca-input"
                  disabled={!orgUnitId && filteredTeams.length === 0}
                >
                  <option value="">Kein Team (nur OrgUnit)</option>
                  {filteredTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.shortName ?? t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="fca-label block">Funktion *</label>
                <select
                  value={functionKey}
                  onChange={(e) => setFunctionKey(e.target.value)}
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
                <div className="sm:col-span-2">
                  <label className="fca-label block">Saison</label>
                  <select
                    value={seasonId}
                    onChange={(e) => setSeasonId(e.target.value)}
                    className="fca-input"
                  >
                    <option value="">Keine Saison</option>
                    <option value={activeSeason.id}>{activeSeason.name} (Aktiv)</option>
                  </select>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </form>
    </Sheet>
  );
}
