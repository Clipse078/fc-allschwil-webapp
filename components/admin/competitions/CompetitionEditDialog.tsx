"use client";

/**
 * CompetitionEditDialog
 *
 * Modal dialog for editing locally-managed fields of a canonical Competition.
 * For MANUAL competitions also allows editing the official name.
 *
 * German UI.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import type { CompetitionListItem } from "@/lib/competitions/dto";

type Props = {
  competition: CompetitionListItem;
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

export default function CompetitionEditDialog({ competition, open, onClose }: Props) {
  const router = useRouter();
  const isManual = competition.provider === "MANUAL";

  const [officialName, setOfficialName] = useState(competition.officialName);
  const [shortName, setShortName] = useState(competition.shortName ?? "");
  const [groupName, setGroupName] = useState(competition.groupName ?? "");
  const [competitionType, setCompetitionType] = useState(competition.competitionType);
  const [gender, setGender] = useState(competition.gender ?? "");
  const [ageCategory, setAgeCategory] = useState(competition.ageCategory ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        shortName: shortName.trim() || null,
        groupName: groupName.trim() || null,
        competitionType,
        gender: gender || null,
        ageCategory: ageCategory.trim() || null,
      };

      if (isManual) {
        body.officialName = officialName.trim();
      }

      const res = await fetch(`/api/competitions/${competition.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Fehler beim Speichern.");
        return;
      }

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
      onClose={onClose}
      title="Wettkampf bearbeiten"
      description={`${competition.officialName} (${competition.provider})`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            Abbrechen
          </Button>
          <Button
            type="submit"
            form="competition-edit-form"
            disabled={submitting || (isManual && !officialName.trim())}
          >
            {submitting ? "Speichern…" : "Änderungen speichern"}
          </Button>
        </>
      }
    >
      <form id="competition-edit-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Offizieller Name — only editable for MANUAL competitions */}
        {isManual && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-officialName">
              Offizieller Name <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-officialName"
              type="text"
              required
              maxLength={255}
              value={officialName}
              onChange={(e) => setOfficialName(e.target.value)}
              className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Kurzname */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-shortName">
            Kurzname
          </label>
          <input
            id="edit-shortName"
            type="text"
            maxLength={50}
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Typ + Geschlecht */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-competitionType">
              Typ
            </label>
            <select
              id="edit-competitionType"
              value={competitionType}
              onChange={(e) => setCompetitionType(e.target.value as typeof competitionType)}
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
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-gender">
              Geschlecht
            </label>
            <select
              id="edit-gender"
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
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-ageCategory">
              Alterskategorie
            </label>
            <input
              id="edit-ageCategory"
              type="text"
              maxLength={50}
              value={ageCategory}
              onChange={(e) => setAgeCategory(e.target.value)}
              placeholder="z.B. U15, Junioren"
              className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-groupName">
              Gruppe
            </label>
            <input
              id="edit-groupName"
              type="text"
              maxLength={100}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {!isManual && (
          <p className="text-xs text-gray-500 italic">
            Provider-verwaltete Felder (offizieller Name, externe IDs) werden durch den Provider-Sync aktualisiert.
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600 rounded-md bg-red-50 border border-red-200 px-3 py-2">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
