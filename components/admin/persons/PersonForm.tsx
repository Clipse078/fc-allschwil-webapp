"use client";

/**
 * PERSON-UX-07 — Person create/edit form.
 *
 * "Profile & Funktionen" section replaces the former "Rollen & Status".
 *
 * Capacity model:
 *   STATUS
 *     [toggle] Person ist aktiv
 *
 *   PROFILE & FUNCTIONS
 *     [toggle] Spieler/in
 *     [toggle] Trainer/in
 *     [toggle] Funktionär/in
 *     [toggle] Schiedsrichter/in
 *     [toggle] Freiwillige/r
 *     [toggle] Sponsor-/Partner-Kontakt
 *     [toggle] Weitere Funktion  → expands chip-based multi-value input
 *
 * Rules:
 *   - All boolean settings use SwitchToggle (no checkboxes here).
 *   - Multiple capacities may be active simultaneously.
 *   - Custom functions are free-text labels; they DO NOT create permissions.
 *   - Create and edit use the same canonical representation.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button, FormSection, ValidationSummary } from "@/components/ui";
import { SwitchToggle } from "@/components/ui/SwitchToggle";
import { FormPagePattern } from "@/components/ui/patterns";

const MAX_CUSTOM_FUNCTION_LENGTH = 100;
const MAX_CUSTOM_FUNCTIONS = 20;

type PersonFormProps = {
  mode: "create" | "edit";
  personId?: string;
  defaultValues?: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
    notes?: string;
    isActive?: boolean;
    isPlayer?: boolean;
    isTrainer?: boolean;
    isFunctionary?: boolean;
    isVolunteer?: boolean;
    isReferee?: boolean;
    isSponsorContact?: boolean;
    customFunctions?: string[];
  };
};

export default function PersonForm({ mode, personId, defaultValues }: PersonFormProps) {
  const router = useRouter();

  const [firstName, setFirstName] = useState(defaultValues?.firstName ?? "");
  const [lastName, setLastName] = useState(defaultValues?.lastName ?? "");
  const [displayName, setDisplayName] = useState(defaultValues?.displayName ?? "");
  const [email, setEmail] = useState(defaultValues?.email ?? "");
  const [phone, setPhone] = useState(defaultValues?.phone ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(defaultValues?.dateOfBirth ?? "");
  const [notes, setNotes] = useState(defaultValues?.notes ?? "");

  // Capacities
  const [isActive, setIsActive] = useState(defaultValues?.isActive ?? true);
  const [isPlayer, setIsPlayer] = useState(defaultValues?.isPlayer ?? false);
  const [isTrainer, setIsTrainer] = useState(defaultValues?.isTrainer ?? false);
  const [isFunctionary, setIsFunctionary] = useState(defaultValues?.isFunctionary ?? false);
  const [isVolunteer, setIsVolunteer] = useState(defaultValues?.isVolunteer ?? false);
  const [isReferee, setIsReferee] = useState(defaultValues?.isReferee ?? false);
  const [isSponsorContact, setIsSponsorContact] = useState(defaultValues?.isSponsorContact ?? false);

  // Weitere Funktion toggle + multi-value chip list
  const [hasCustomFunctions, setHasCustomFunctions] = useState(
    (defaultValues?.customFunctions ?? []).length > 0,
  );
  const [customFunctions, setCustomFunctions] = useState<string[]>(
    defaultValues?.customFunctions ?? [],
  );
  const [customFunctionInput, setCustomFunctionInput] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleAddCustomFunction() {
    const val = customFunctionInput.trim();
    if (!val) return;
    if (val.length > MAX_CUSTOM_FUNCTION_LENGTH) return;
    if (customFunctions.includes(val)) return;
    if (customFunctions.length >= MAX_CUSTOM_FUNCTIONS) return;
    setCustomFunctions((prev) => [...prev, val]);
    setCustomFunctionInput("");
  }

  function handleRemoveCustomFunction(label: string) {
    setCustomFunctions((prev) => prev.filter((f) => f !== label));
  }

  function handleCustomFunctionKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddCustomFunction();
    }
  }

  function validate(): string | null {
    if (!firstName.trim()) return "Vorname ist erforderlich.";
    if (firstName.trim().length > 100) return "Vorname darf maximal 100 Zeichen lang sein.";
    if (!lastName.trim()) return "Nachname ist erforderlich.";
    if (lastName.trim().length > 100) return "Nachname darf maximal 100 Zeichen lang sein.";
    if (displayName.trim().length > 150) return "Anzeigename darf maximal 150 Zeichen lang sein.";
    if (email.trim() && (!email.includes("@") || !email.includes("."))) {
      return "Ungültige E-Mail-Adresse.";
    }
    if (phone.trim().length > 50) return "Telefonnummer darf maximal 50 Zeichen lang sein.";
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      if (Number.isNaN(dob.getTime())) return "Ungültiges Geburtsdatum.";
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dobNorm = new Date(dateOfBirth);
      dobNorm.setHours(0, 0, 0, 0);
      if (dobNorm > today) return "Geburtsdatum darf nicht in der Zukunft liegen.";
    }
    if (notes.trim().length > 1000) return "Notizen dürfen maximal 1000 Zeichen lang sein.";
    for (const fn of customFunctions) {
      if (fn.length > MAX_CUSTOM_FUNCTION_LENGTH) {
        return `Funktion «${fn}» darf maximal ${MAX_CUSTOM_FUNCTION_LENGTH} Zeichen lang sein.`;
      }
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const url =
        mode === "edit" && personId ? `/api/people/${personId}` : "/api/people";
      const method = mode === "edit" ? "PUT" : "POST";

      // When "Weitere Funktion" toggle is off, send empty array
      const effectiveCustomFunctions = hasCustomFunctions ? customFunctions : [];

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          displayName: displayName.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          dateOfBirth: dateOfBirth || null,
          notes: notes.trim() || null,
          isActive,
          isPlayer,
          isTrainer,
          isFunctionary,
          isVolunteer,
          isReferee,
          isSponsorContact,
          customFunctions: effectiveCustomFunctions,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Fehler beim Speichern.");
        return;
      }

      router.push("/dashboard/persons");
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  const pageTitle =
    mode === "create"
      ? "Neue Person"
      : firstName && lastName
        ? `${firstName} ${lastName} bearbeiten`
        : "Person bearbeiten";

  const breadcrumbs = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Personen", href: "/dashboard/persons" },
    { label: pageTitle },
  ];

  return (
    <form onSubmit={handleSubmit}>
      <FormPagePattern
        eyebrow="Personen"
        title={pageTitle}
        description={
          mode === "create"
            ? "Lege einen neuen Personendatensatz im System an."
            : "Stammdaten, Kontakt, Profile und Status dieser Person anpassen."
        }
        breadcrumbs={breadcrumbs}
        validationSummary={
          error ? <ValidationSummary errors={[error]} /> : undefined
        }
        cancelAction={
          <Button
            variant="secondary"
            type="button"
            onClick={() => router.back()}
          >
            Abbrechen
          </Button>
        }
        primaryAction={
          <Button type="submit" loading={loading}>
            {mode === "create" ? "Person erstellen" : "Änderungen speichern"}
          </Button>
        }
      >
        <FormSection
          title="Stammdaten"
          description="Name und optionales Geburtsdatum der Person."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="fca-label block">Vorname *</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
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
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Nachname"
                maxLength={100}
                className="fca-input"
                required
              />
            </div>
            <div>
              <label className="fca-label block">Anzeigename</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="z.B. Spitzname oder bevorzugter Name"
                maxLength={150}
                className="fca-input"
              />
            </div>
            <div>
              <label className="fca-label block">Geburtsdatum</label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="fca-input"
              />
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Kontakt"
          description="E-Mail-Adresse und Telefonnummer."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="fca-label block">E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
          </div>
        </FormSection>

        {/* ── Profile & Funktionen ──────────────────────────────────────── */}
        <FormSection
          title="Profile & Funktionen"
          description="Welche Profile hat diese Person im Verein? Mehrere Profile sind möglich."
        >
          {/* STATUS */}
          <div className="mb-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)]">
              Status
            </p>
            <SwitchToggle
              id="isActive"
              label="Person ist aktiv"
              description="Inaktive Personen erscheinen in Filtern und Auswahllisten nicht mehr."
              checked={isActive}
              onChange={setIsActive}
            />
          </div>

          {/* STANDARD CAPACITIES */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)]">
              Profile & Funktionen
            </p>
            <div className="space-y-2">
              <SwitchToggle
                id="isPlayer"
                label="Spieler/in"
                description="Aktiviert den Spieler-Workspace (Kader, Entwicklung, Assessments)."
                checked={isPlayer}
                onChange={setIsPlayer}
              />
              <SwitchToggle
                id="isTrainer"
                label="Trainer/in"
                description="Aktiviert den Trainer-Workspace (Teameinsätze, Trainerkarriere)."
                checked={isTrainer}
                onChange={setIsTrainer}
              />
              <SwitchToggle
                id="isFunctionary"
                label="Funktionär/in"
                description="Person bekleidet ein Vereinsamt (Vorstand, Ausschuss, o.ä.)."
                checked={isFunctionary}
                onChange={setIsFunctionary}
              />
              <SwitchToggle
                id="isReferee"
                label="Schiedsrichter/in"
                description="Person ist als Schiedsrichter/in aktiv."
                checked={isReferee}
                onChange={setIsReferee}
              />
              <SwitchToggle
                id="isVolunteer"
                label="Freiwillige/r"
                description="Person engagiert sich freiwillig ohne feste Funktion."
                checked={isVolunteer}
                onChange={setIsVolunteer}
              />
              <SwitchToggle
                id="isSponsorContact"
                label="Sponsor-/Partner-Kontakt"
                description="Person ist Ansprechpartner/in für Sponsoring oder Partnerschaften."
                checked={isSponsorContact}
                onChange={setIsSponsorContact}
              />

              {/* Weitere Funktion — expands to chip-based input when ON */}
              <SwitchToggle
                id="hasCustomFunctions"
                label="Weitere Funktion"
                description="Vereinsspezifische Funktion (z.B. Materialwart, Fotograf/in)."
                checked={hasCustomFunctions}
                onChange={(v) => {
                  setHasCustomFunctions(v);
                  if (!v) {
                    setCustomFunctionInput("");
                  }
                }}
              />

              {hasCustomFunctions ? (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
                  {/* Existing chips */}
                  {customFunctions.length > 0 ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {customFunctions.map((fn) => (
                        <span
                          key={fn}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--foreground)]"
                        >
                          {fn}
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomFunction(fn)}
                            aria-label={`${fn} entfernen`}
                            className="flex h-4 w-4 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {/* Add new function */}
                  {customFunctions.length < MAX_CUSTOM_FUNCTIONS ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={customFunctionInput}
                        onChange={(e) => setCustomFunctionInput(e.target.value)}
                        onKeyDown={handleCustomFunctionKeyDown}
                        placeholder="Funktion hinzufügen…"
                        maxLength={MAX_CUSTOM_FUNCTION_LENGTH}
                        className="fca-input flex-1 text-sm"
                        aria-label="Neue Funktion eingeben"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleAddCustomFunction}
                        disabled={!customFunctionInput.trim()}
                      >
                        <Plus className="h-4 w-4" />
                        Hinzufügen
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--muted)]">
                      Maximale Anzahl ({MAX_CUSTOM_FUNCTIONS}) an Funktionen erreicht.
                    </p>
                  )}

                  <p className="mt-2 text-[11px] text-[var(--muted)]">
                    Drücke Enter oder Komma, um eine Funktion hinzuzufügen.
                    Diese Funktionen erzeugen keine Berechtigungen.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Notizen"
          description="Interne Notizen, die nur für Administratoren sichtbar sind."
        >
          <div>
            <label className="fca-label block">Interne Notizen</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Optionale interne Notizen…"
              maxLength={1000}
              className="fca-input resize-none"
            />
            <p className="mt-1 text-right text-[11px] text-[var(--muted)]">
              {notes.length}/1000
            </p>
          </div>
        </FormSection>
      </FormPagePattern>
    </form>
  );
}
