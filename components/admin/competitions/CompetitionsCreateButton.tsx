"use client";

/**
 * CompetitionsCreateButton
 *
 * Client wrapper that renders the "Neuer Wettkampf" button and manages
 * the CompetitionCreateDialog open/close state.
 */

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import CompetitionCreateDialog from "./CompetitionCreateDialog";

export default function CompetitionsCreateButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} className="flex items-center gap-1.5">
        <Plus className="h-4 w-4" />
        Neuer Wettkampf
      </Button>

      <CompetitionCreateDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
