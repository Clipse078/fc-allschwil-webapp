"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import PersonDirectory from "./PersonDirectory";
import PersonCreateSheet from "./PersonCreateSheet";
import type { PersonDirectoryItem } from "@/lib/people/queries";

type OrgUnitOption = { id: string; name: string };
type TeamOption = {
  id: string;
  name: string;
  shortName?: string | null;
  orgUnitIds?: string[];
};
type SeasonOption = { id: string; name: string };

type PersonsPageClientProps = {
  persons: PersonDirectoryItem[];
  orgUnits: OrgUnitOption[];
  teams: TeamOption[];
  activeSeason: SeasonOption | null;
  /** When true, only render the CTA button (for headerActions slot). */
  ctaOnly?: boolean;
};

export default function PersonsPageClient({
  persons,
  orgUnits,
  teams,
  activeSeason,
  ctaOnly = false,
}: PersonsPageClientProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  if (ctaOnly) {
    return (
      <>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="fca-button-primary"
        >
          <UserPlus className="h-4 w-4" />
          Person hinzufügen
        </button>
        <PersonCreateSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          orgUnits={orgUnits}
          teams={teams}
          activeSeason={activeSeason}
        />
      </>
    );
  }

  return (
    <>
      <PersonDirectory
        persons={persons}
        orgUnits={orgUnits}
        teams={teams}
        onAddPerson={() => setSheetOpen(true)}
      />
      <PersonCreateSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        orgUnits={orgUnits}
        teams={teams}
        activeSeason={activeSeason}
      />
    </>
  );
}
