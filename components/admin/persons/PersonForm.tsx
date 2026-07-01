"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormSection, ValidationSummary } from "@/components/ui";
import { FormPagePattern } from "@/components/ui/patterns";

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
  const [isActive, setIsActive] = useState(defaultValues?.isActive ?? true);
  const [isPlayer, setIsPlayer] = useState(defaultValues?.isPlayer ?? false);
  const [isTrainer, setIsTrainer] = useState(defaultValues?.isTrainer ?? false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            : "Stammdaten, Kontakt, Rollen und Status dieser Person anpassen."
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

        <FormSection
          title="Rollen & Status"
          description="Aktiv-Status und Rollen der Person im Verein."
        >
          <div className="space-y-2">
            <Toggle
              id="isActive"
              label="Person ist aktiv"
              checked={isActive}
              onChange={setIsActive}
            />
            <Toggle
              id="isPlayer"
              label="Spieler"
              checked={isPlayer}
              onChange={setIsPlayer}
            />
            <Toggle
              id="isTrainer"
              label="Trainer"
              checked={isTrainer}
              onChange={setIsTrainer}
            />
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

function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3"
    >
      <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-[var(--border)] accent-[var(--sce-primary)]"
      />
    </label>
  );
}
