"use client";

import { AlertTriangle, CheckCircle2, Lightbulb, Sparkles, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PeoplePicker, { PeoplePickerPerson } from "@/components/admin/shared/people-picker/PeoplePicker";

type RecommendedTrainer = {
  id: string;
  displayName: string;
  functionLabel?: string | null;
  teamLabel?: string | null;
};

type Props = {
  kpiBreakdown?: { name: string; required: number; actual: number }[];
  teamId: string;
  teamSeasonId: string;
  canManage: boolean;
  trainerCount: number;
  hasHealthyPlayerTrainerRatio?: boolean | null;
};

function getActionState(hasIssues: boolean) {
  if (hasIssues) {
    return {
      label: "Aktion empfohlen",
      className: "border-amber-200 bg-amber-50 text-amber-800",
      icon: <AlertTriangle className="h-4 w-4" />,
    };
  }

  return {
    label: "Keine Aktion nötig",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: <CheckCircle2 className="h-4 w-4" />,
  };
}

export default function TeamQuickActionsCard({
  teamId,
  teamSeasonId,
  canManage,
  trainerCount,
  hasHealthyPlayerTrainerRatio = null,
  kpiBreakdown = [],
}: Props) {
  const router = useRouter();

  const [selectedTrainer, setSelectedTrainer] = useState<PeoplePickerPerson | null>(null);
  const [recommended, setRecommended] = useState<RecommendedTrainer[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const missingQualifications = useMemo(
    () => kpiBreakdown.filter((item) => item.actual < item.required),
    [kpiBreakdown],
  );

  const needsTrainer = trainerCount === 0 || trainerCount < 2;
  const ratioProblem = hasHealthyPlayerTrainerRatio === false;
  const hasDiplomaProblem = missingQualifications.length > 0;
  const hasIssues = needsTrainer || ratioProblem || hasDiplomaProblem;
  const actionState = getActionState(hasIssues);

  const actionHints = [
    needsTrainer ? `${trainerCount === 0 ? "Kein Trainer erfasst" : "Traineranzahl prüfen"} · Aktuell ${trainerCount}` : null,
    ratioProblem ? "Betreuung prüfen · Spieler pro Trainer liegt über Zielwert" : null,
    ...missingQualifications.map((item) => `${item.name}: ${item.actual}/${item.required} erfüllt`),
  ].filter(Boolean) as string[];

  useEffect(() => {
    async function loadRecommendations() {
      try {
        const res = await fetch(`/api/teams/${teamId}/team-seasons/${teamSeasonId}/recommended-trainers`);
        const data = await res.json().catch(() => []);

        if (Array.isArray(data)) {
          setRecommended(data.slice(0, 3));
        }
      } catch {
        setRecommended([]);
      }
    }

    if (hasIssues) {
      void loadRecommendations();
    } else {
      setRecommended([]);
    }
  }, [teamId, teamSeasonId, hasIssues]);

  async function assignTrainerById(personId: string) {
    if (!canManage) return;

    setIsAssigning(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/teams/${teamId}/team-seasons/${teamSeasonId}/trainer-members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Trainer konnte nicht zugewiesen werden.");
      }

      setSelectedTrainer(null);
      setMessage(data?.message ?? "Trainer erfolgreich zugewiesen.");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Trainer konnte nicht zugewiesen werden.");
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
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="h-[3px] w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />

      <div className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="fca-eyebrow">Schnellaktionen</p>
            <h3 className="mt-2 flex items-center gap-2 text-lg font-black text-[#0b4aa2]">
              <Sparkles className="h-5 w-5 text-[#d62839]" />
              Team Assistant
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Erkennt automatisch, ob Traineranzahl, Betreuung oder Qualifikationen Aufmerksamkeit brauchen.
            </p>
          </div>

          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${actionState.className}`}>
            {actionState.icon}
            {actionState.label}
          </span>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.95fr]">
          <div className={`rounded-[24px] border p-5 ${hasIssues ? "border-amber-100 bg-amber-50/60" : "border-emerald-100 bg-emerald-50/60"}`}>
            <div className="flex items-start gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${hasIssues ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                {hasIssues ? <Lightbulb className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
              </div>

              <div>
                <p className="text-sm font-black text-slate-900">
                  {hasIssues ? "Empfohlene nächste Schritte" : "Team sieht aktuell gut aus"}
                </p>

                <div className="mt-3 space-y-2">
                  {hasIssues ? (
                    actionHints.map((hint) => (
                      <div key={hint} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        {hint}
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Keine akute Massnahme notwendig.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-[#0b4aa2]">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900">Trainer zuweisen</p>
                <p className="text-xs font-semibold text-slate-500">Direkt suchen oder Empfehlung nutzen.</p>
              </div>
            </div>

            <div className="mt-4">
              <PeoplePicker
                selected={selectedTrainer}
                onSelect={setSelectedTrainer}
                searchMode="trainer"
                teamSeasonId={teamSeasonId}
                placeholder="Trainer suchen..."
                disabled={isAssigning}
              />
            </div>

            {errorMessage ? <div className="mt-3 text-sm font-semibold text-red-600">{errorMessage}</div> : null}
            {message ? <div className="mt-3 text-sm font-semibold text-emerald-700">{message}</div> : null}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => assignTrainer()}
                disabled={!selectedTrainer || isAssigning}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#0b4aa2]/20 bg-white px-5 text-sm font-black text-[#0b4aa2] shadow-sm transition hover:border-[#0b4aa2] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" />
                Trainer zuweisen
              </button>
            </div>
          </div>
        </div>

        {hasIssues && recommended.length > 0 ? (
          <div className="mt-5 rounded-[24px] border border-blue-100 bg-blue-50/70 p-5">
            <p className="text-sm font-black text-slate-900">Empfohlene Trainer</p>

            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              {recommended.map((trainer) => (
                <div key={trainer.id} className="rounded-[20px] border border-blue-100 bg-white p-4 shadow-sm">
                  <p className="text-sm font-black text-slate-900">{trainer.displayName}</p>
                  <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">
                    {trainer.teamLabel || trainer.functionLabel || "Trainer"}
                  </p>

                  <button
                    type="button"
                    onClick={() => assignTrainerById(trainer.id)}
                    disabled={isAssigning}
                    className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-full border border-red-200 bg-white px-4 text-xs font-black text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    Direkt zuweisen
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
