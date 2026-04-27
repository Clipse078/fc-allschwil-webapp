"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PeoplePicker, { PeoplePickerPerson } from "@/components/admin/shared/people-picker/PeoplePicker";

type RecommendedTrainer = {
  id: string;
  displayName: string;
  functionLabel?: string | null;
  teamLabel?: string | null;
};

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
  const [recommended, setRecommended] = useState<RecommendedTrainer[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const shouldSuggestTrainer =
    trainerCount === 0 || hasHealthyPlayerTrainerRatio === false;

  useEffect(() => {
    async function loadRecommendations() {
      try {
        const res = await fetch(
          `/api/teams/${teamId}/team-seasons/${teamSeasonId}/recommended-trainers`
        );
        const data = await res.json().catch(() => []);

        if (Array.isArray(data)) {
          setRecommended(data.slice(0, 3));
        }
      } catch {
        setRecommended([]);
      }
    }

    if (shouldSuggestTrainer) {
      loadRecommendations();
    }
  }, [teamId, teamSeasonId, shouldSuggestTrainer]);

  async function assignTrainerById(personId: string) {
    if (!canManage) return;

    setIsAssigning(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/teams/${teamId}/team-seasons/${teamSeasonId}/trainer-members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ personId }),
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

  async function assignTrainer() {
    if (!selectedTrainer) return;
    await assignTrainerById(selectedTrainer.id);
  }

  if (!canManage) return null;

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="fca-eyebrow">Quick actions</p>
          <h3 className="mt-2 text-lg font-black text-[#0b4aa2]">Fix team health</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Assign a trainer directly or use smart recommendations.
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

      {/* ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â¥ RECOMMENDED TRAINERS */}
      {shouldSuggestTrainer && recommended.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-black text-slate-900">Top recommendations</p>

          <div className="mt-3 space-y-2">
            {recommended.map((trainer) => (
              <div
                key={trainer.id}
                className="flex items-center justify-between rounded-[18px] border border-slate-200 bg-white px-4 py-3"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {trainer.displayName}
                  </div>
                  <div className="text-xs text-slate-500">
                    {trainer.functionLabel || "Trainer"}
                    {trainer.teamLabel ? ` ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ ${trainer.teamLabel}` : ""}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => assignTrainerById(trainer.id)}
                  disabled={isAssigning}
                  className="rounded-full border border-red-200 bg-white px-4 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Assign
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â MANUAL PICKER */}
      <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-black text-slate-900">Manual assign</p>

        <div className="mt-3">
          <PeoplePicker
            selected={selectedTrainer}
            onSelect={setSelectedTrainer}
            searchMode="trainer"
            teamSeasonId={teamSeasonId}
            placeholder="Search trainer..."
            disabled={isAssigning}
          />
        </div>

        {errorMessage && (
          <div className="mt-4 text-sm text-red-600">{errorMessage}</div>
        )}

        {message && (
          <div className="mt-4 text-sm text-emerald-600">{message}</div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => assignTrainer()}
            disabled={!selectedTrainer || isAssigning}
            className="rounded-full border border-red-200 bg-white px-5 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Assign trainer
          </button>
        </div>
      </div>
    </section>
  );
}
