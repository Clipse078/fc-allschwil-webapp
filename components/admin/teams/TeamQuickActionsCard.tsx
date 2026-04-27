"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PeoplePicker, { PeoplePickerPerson } from "@/components/admin/shared/people-picker/PeoplePicker";

type RecommendedTrainer = {
  id: string;
  displayName: string;
  email?: string | null;
  bestQualification?: string | null;
  qualificationMatches: boolean;
  activeAssignmentCount: number;
  reason: string;
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

  const [recommended, setRecommended] = useState<RecommendedTrainer[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  const [selectedTrainer, setSelectedTrainer] = useState<PeoplePickerPerson | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const shouldSuggestTrainer =
    trainerCount === 0 || hasHealthyPlayerTrainerRatio === false;

  useEffect(() => {
    async function loadRecommendations() {
      try {
        setLoadingRecommendations(true);

        const res = await fetch(
          `/api/teams/${teamId}/team-seasons/${teamSeasonId}/recommended-trainers`
        );

        const data = await res.json().catch(() => null);

        if (!res.ok) throw new Error(data?.error);

        setRecommended(Array.isArray(data?.recommendations) ? data.recommendations : []);
      } catch {
        setRecommended([]);
      } finally {
        setLoadingRecommendations(false);
      }
    }

    if (shouldSuggestTrainer) {
      void loadRecommendations();
    }
  }, [teamId, teamSeasonId, shouldSuggestTrainer]);

  async function assignTrainerById(personId: string) {
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

      if (!response.ok) throw new Error(data?.error);

      setMessage("Trainer assigned successfully.");
      setSelectedTrainer(null);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed.");
    } finally {
      setIsAssigning(false);
    }
  }

  if (!canManage) return null;

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex justify-between items-start">
        <div>
          <p className="fca-eyebrow">Quick actions</p>
          <h3 className="mt-2 text-lg font-black text-[#0b4aa2]">Fix team health</h3>
        </div>

        <span className={`rounded-full px-3 py-1.5 text-xs font-black ${
          shouldSuggestTrainer
            ? "bg-red-50 text-red-700"
            : "bg-emerald-50 text-emerald-700"
        }`}>
          {shouldSuggestTrainer ? "Action recommended" : "Healthy"}
        </span>
      </div>

      {/* 🔥 RECOMMENDED TRAINERS */}
      {shouldSuggestTrainer && (
        <div className="mt-6">
          <p className="text-sm font-black text-slate-900">Recommended trainers</p>

          {loadingRecommendations ? (
            <p className="text-sm text-slate-500 mt-2">Loading recommendations...</p>
          ) : recommended.length === 0 ? (
            <p className="text-sm text-slate-500 mt-2">No strong matches found.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {recommended.map((trainer) => (
                <div
                  key={trainer.id}
                  className="flex items-center justify-between rounded-[18px] border border-slate-200 px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {trainer.displayName}
                    </div>
                    <div className="text-xs text-slate-500">
                      {trainer.bestQualification || "No diploma info"} ·{" "}
                      {trainer.activeAssignmentCount} teams
                    </div>
                  </div>

                  <button
                    onClick={() => assignTrainerById(trainer.id)}
                    disabled={isAssigning}
                    className="rounded-full border border-red-200 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50"
                  >
                    Assign
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 🔎 MANUAL PICKER */}
      <div className="mt-6">
        <p className="text-sm font-black text-slate-900">Manual assign</p>

        <div className="mt-3">
          <PeoplePicker
            selected={selectedTrainer}
            onSelect={setSelectedTrainer}
            searchMode="trainer"
            teamSeasonId={teamSeasonId}
          />
        </div>

        <div className="mt-3 flex justify-end">
          <button
            onClick={() => selectedTrainer && assignTrainerById(selectedTrainer.id)}
            disabled={!selectedTrainer || isAssigning}
            className="rounded-full border border-red-200 px-5 py-2 text-sm font-black text-red-600 hover:bg-red-50"
          >
            Assign trainer
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-4 text-sm text-red-600">{errorMessage}</div>
      )}

      {message && (
        <div className="mt-4 text-sm text-emerald-600">{message}</div>
      )}
    </section>
  );
}