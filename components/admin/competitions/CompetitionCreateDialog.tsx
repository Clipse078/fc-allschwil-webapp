"use client";

/**
 * CompetitionCreateDialog
 *
 * Modal dialog for manually creating a canonical Competition record.
 * Used by tenants with no provider integration and for custom local entries.
 *
 * German UI. Accessible modal built on the shared Dialog primitive.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

type Props = {
  open: boolean;
  onClose: () => void;
};

const COMPETITION_TYPE_OPTIONS = [
  { value: "LEAGUE", label: "Liga" },
  { value: "CUP", label: "Cup" },
  { value: "TOURNAMENT_SERIES", label: "Turnierserie" },
  { value: "OTHER", label: "Sonstige" },
];

const GENDER_OPTIONS = [
  { value: "", label: "— nicht angegeben —" },
  { value: "MALE", label: "Herren" },
  { value: "FEMALE", label: "Frauen" },
  { value: "MIXED", label: "Mixed" },
];

export default function CompetitionCreateDialog({ open, onClose }: Props) {
  const router = useRouter();

  const [officialName, setOfficialName] = useState("");
  const [shortName, setShortName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [competitionType, setCompetitionType] = useState("LEAGUE");
  const [gender, setGender] = useState("");
  const [ageCategory, setAgeCategory] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setOfficialName("");
    setShortName("");
    setGroupName("");
    setCompetitionType("LEAGUE");
    setGender("");
    setAgeCategory("");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const body = {
        provider: "MANUAL",
        officialName: officialName.trim(),
        shortName: shortName.trim() || undefined,
        groupName: groupName.trim() || undefined,
        competitionType,
        gender: gender || undefined,
        ageCategory: ageCategory.trim() || undefined,
      };

      const res = await fetch("/api/competitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Fehler beim Erstellen des Wettkampfs.");
        return;
      }

      reset();
      onClose();
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte versuche es erneut.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Wettkampf erstellen"
      description="Manuell erfasster Wettkampf. Kein Provider erforderlich."
      size="lg"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={handleClose} disabled={submitting}>
            Abbrechen
          </Button>
          <Button
            type="submit"
            form="competition-create-form"
            disabled={submitting || !officialName.trim()}
          >
            {submitting ? "Speichern…" : "Wettkampf erstellen"}
          </Button>
        </>
      }
    >
      <form id="competition-create-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Offizieller Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="officialName">
            Offizieller Name <span className="text-red-500">*</span>
          </label>
          <input
            id="officialName"
            type="text"
            required
            maxLength={255}
            value={officialName}
            onChange={(e) => setOfficialName(e.target.value)}
            placeholder="z.B. Regionalcup 2026/2027"
            className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Kurzname */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="shortName">
            Kurzname
          </label>
          <input
            id="shortName"
            type="text"
            maxLength={50}
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            placeholder="z.B. Regionalcup"
            className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Typ + Geschlecht */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="competitionType">
              Typ
            </label>
            <select
              id="competitionType"
              value={competitionType}
              onChange={(e) => setCompetitionType(e.target.value)}
              className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {COMPETITION_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="gender">
              Geschlecht
            </label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {GENDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Altersgruppe + Gruppe */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="ageCategory">
              Alterskategorie
            </label>
            <input
              id="ageCategory"
              type="text"
              maxLength={50}
              value={ageCategory}
              onChange={(e) => setAgeCategory(e.target.value)}
              placeholder="z.B. U15, Junioren"
              className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="groupName">
              Gruppe
            </label>
            <input
              id="groupName"
              type="text"
              maxLength={100}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="z.B. Gruppe A"
              className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 rounded-md bg-red-50 border border-red-200 px-3 py-2">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
