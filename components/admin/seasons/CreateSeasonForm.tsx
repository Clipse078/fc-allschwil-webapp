import { Plus } from "lucide-react";
import { createSeasonAction } from "@/app/(admin)/dashboard/seasons/actions";

type Props = {
  suggestedStartYear: number | null;
};

/**
 * SEASON-01 — "Neue Saison": creates a Season by explicit start year.
 * Deliberately NOT restricted to "the next chronological season" — an
 * admin may create 2026/2027 even while 2027/2028 already exists. The
 * suggested value is only a convenience default, never a restriction.
 */
export default function CreateSeasonForm({ suggestedStartYear }: Props) {
  return (
    <form
      id="create-season"
      action={createSeasonAction}
      className="flex flex-wrap items-end gap-3 rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-sm)]"
    >
      <div>
        <label htmlFor="startYear" className="mb-1 block text-xs font-medium text-[var(--muted)]">
          Startjahr
        </label>
        <input
          id="startYear"
          name="startYear"
          type="number"
          required
          step={1}
          defaultValue={suggestedStartYear ?? undefined}
          placeholder="z. B. 2026"
          className="fca-input w-32"
        />
      </div>
      <button type="submit" className="fca-button-primary">
        <Plus className="h-4 w-4" />
        Neue Saison erstellen
      </button>
      <p className="w-full text-xs text-[var(--muted)]">
        Erstellt die Saison „Startjahr/Startjahr+1“ (z. B. 2026 → 2026/2027). Bereits vorhandene spätere
        oder frühere Saisons verhindern das nicht.
      </p>
    </form>
  );
}
