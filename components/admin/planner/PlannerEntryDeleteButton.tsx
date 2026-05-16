"use client";

import { useFormStatus } from "react-dom";
import { deletePlannerEntryAction } from "@/app/(admin)/dashboard/planner/actions";

type PlannerEntryDeleteButtonProps = {
  eventId: string;
  seasonKey: string;
};

function DeleteSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 items-center rounded-full border border-rose-200 bg-rose-50 px-5 text-sm font-medium text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Löschen..." : "Eintrag löschen"}
    </button>
  );
}

export default function PlannerEntryDeleteButton({
  eventId,
  seasonKey,
}: PlannerEntryDeleteButtonProps) {
  return (
    <form
      action={deletePlannerEntryAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          "Möchtest du diesen Planner-Eintrag wirklich löschen?",
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="seasonKey" value={seasonKey} />
      <DeleteSubmitButton />
    </form>
  );
}
