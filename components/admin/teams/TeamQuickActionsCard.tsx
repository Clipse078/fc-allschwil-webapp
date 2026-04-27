"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import PeoplePicker, { PeoplePickerPerson } from "@/components/admin/shared/people-picker/PeoplePicker";

type Props = {
  teamId: string;
  teamSeasonId: string;
  canManage: boolean;
  trainerCount: number;
  hasHealthyPlayerTrainerRatio?: boolean | null;
};

export default function TeamQuickActionsCard({
  teamId,
  teamSeasonId,
  canManage,
  trainerCount,
  hasHealthyPlayerTrainerRatio = null,
}: Props) {
  const router = useRouter();
  const [selectedTrainer, setSelectedTrainer] = useState<PeoplePickerPerson | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const shouldSuggestTrainer =
    trainerCount === 0 || hasHealthyPlayerTrainerRatio === false;

  async function assignTrainer() {
    if (!selectedTrainer || !canManage) return;

    setIsAssigning(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/teams/${teamId}/team-seasons/${teamSeasonId}/trainer-members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ personId: selectedTrainer.id }),
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Trainer could not be assigned.");
      }

      setSelectedTrainer(null);
      setMessage(data?.message ?? "Trainer assigned successfully.");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Trainer could not be assigned.");
    } finally {
      setIsAssigning(false);
    }
  }

  if (!canManage) return null;

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="fca-eyebrow">Quick actions</p>
          <h3 className="mt-2 text-lg font-black text-[#0b4aa2]">Fix team health</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Assign a trainer directly from the team health context without leaving this page.
          </p>
        </div>

        <span
          className={`rounded-full border px-3 py-1.5 text-xs font-black ${
            shouldSuggestTrainer
              ? "border-red-100 bg-red-50 text-red-700"
              : "border-emerald-100 bg-emerald-50 text-emerald-700"
          }`}
        >
          {shouldSuggestTrainer ? "Action recommended" : "No urgent action"}
        </span>
      </div>

      <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
        <div>
          <p className="text-sm font-black text-slate-900">Assign trainer</p>
          <p className="mt-1 text-sm text-slate-500">
            Search only shows eligible trainer-type people for this team season.
          </p>
        </div>

        <div className="mt-4">
          <PeoplePicker
            selected={selectedTrainer}
            onSelect={setSelectedTrainer}
            searchMode="trainer"
            teamSeasonId={teamSeasonId}
            placeholder="Search trainer..."
            emptyText="No eligible trainer found."
            disabled={isAssigning}
          />
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-[18px] border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {message ? (
          <div className="mt-4 rounded-[18px] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {message}
          </div>
        ) : null}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={assignTrainer}
            disabled={!selectedTrainer || isAssigning}
            className="inline-flex h-11 items-center justify-center rounded-full border border-red-200 bg-white px-5 text-sm font-black text-red-600 shadow-sm transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAssigning ? "Assigning..." : "Assign trainer"}
          </button>
        </div>
      </div>
    </section>
  );
}