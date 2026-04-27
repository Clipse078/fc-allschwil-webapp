"use client";

import { CheckCircle2, Info, ShieldCheck } from "lucide-react";

type BirthYearCount = {
  year: number;
  count: number;
};

type DiplomaCount = {
  label: string;
  count: number;
};

type QualificationRequirement = {
  qualificationName: string | null;
  requiredTrainerCount: number;
  matchingTrainerCount: number;
  isFulfilled: boolean;
  fulfilledByQualificationName?: string | null;
};

type Props = {
  seasonLabel: string;
  playerCount: number;
  trainerCount: number;
  birthYears: BirthYearCount[];
  diplomas: DiplomaCount[];
  diplomaRequirement?: string | null;
  qualificationRequirements?: QualificationRequirement[];
  maxPlayersPerTrainer?: number | null;
  hasHealthyPlayerTrainerRatio?: boolean | null;
};

function getPlayersPerTrainer(playerCount: number, trainerCount: number) {
  if (trainerCount <= 0) return null;
  return Math.round((playerCount / trainerCount) * 10) / 10;
}

function getRatioState(
  playerCount: number,
  trainerCount: number,
  maxPlayersPerTrainer?: number | null,
  hasHealthyPlayerTrainerRatio?: boolean | null,
) {
  const playersPerTrainer = getPlayersPerTrainer(playerCount, trainerCount);

  if (trainerCount <= 0 || playersPerTrainer === null) {
    return {
      label: "Betreuung fehlt",
      description: "Noch keine Trainer erfasst",
      className: "border-red-100 bg-red-50 text-red-700",
      dotClassName: "bg-red-500",
    };
  }

  if (typeof maxPlayersPerTrainer === "number" && maxPlayersPerTrainer > 0) {
    if (hasHealthyPlayerTrainerRatio) {
      return {
        label: "Betreuung erfüllt",
        description: String(playersPerTrainer) + " Spieler pro Trainer · Soll ≤ " + String(maxPlayersPerTrainer),
        className: "border-emerald-100 bg-emerald-50 text-emerald-700",
        dotClassName: "bg-emerald-500",
      };
    }

    return {
      label: "Betreuung prüfen",
      description: String(playersPerTrainer) + " Spieler pro Trainer · Soll ≤ " + String(maxPlayersPerTrainer),
      className: "border-amber-100 bg-amber-50 text-amber-700",
      dotClassName: "bg-amber-500",
    };
  }

  return {
    label: "Betreuung",
    description: String(playersPerTrainer) + " Spieler pro Trainer",
    className: "border-blue-100 bg-blue-50 text-[#0b4aa2]",
    dotClassName: "bg-[#0b4aa2]",
  };
}

function diplomaPriority(label: string) {
  const normalized = label.toUpperCase();

  if (normalized.includes("A-DIPLOM") || normalized.includes("UEFA A")) return 1;
  if (normalized.includes("B-DIPLOM") || normalized.includes("UEFA B")) return 2;
  if (normalized.includes("C-DIPLOM") || normalized.includes("UEFA C")) return 3;
  if (normalized.includes("D-DIPLOM") || normalized.includes("SFV D")) return 4;
  if (normalized.includes("KINDERFUSSBALL")) return 5;

  return 99;
}

export default function TeamHealthCard({
  seasonLabel,
  playerCount,
  trainerCount,
  birthYears,
  diplomas,
  diplomaRequirement = null,
  qualificationRequirements = [],
  maxPlayersPerTrainer = null,
  hasHealthyPlayerTrainerRatio = null,
}: Props) {
  const ratioState = getRatioState(playerCount, trainerCount, maxPlayersPerTrainer, hasHealthyPlayerTrainerRatio);

  const sortedDiplomas = [...diplomas].sort(
    (a, b) => diplomaPriority(a.label) - diplomaPriority(b.label) || a.label.localeCompare(b.label),
  );

  const relevantRequirement =
    qualificationRequirements.find((item) => item.qualificationName === diplomaRequirement) ??
    qualificationRequirements[0] ??
    null;

  const requirementMet = relevantRequirement ? relevantRequirement.isFulfilled : null;
  const requirementLabel = relevantRequirement?.qualificationName ?? diplomaRequirement;
  const fulfilledByLabel = relevantRequirement?.fulfilledByQualificationName ?? null;
  const showFulfillmentExplanation = Boolean(requirementMet && requirementLabel && fulfilledByLabel && fulfilledByLabel !== requirementLabel);

  const diplomaClass =
    requirementMet === null
      ? "border-slate-200 bg-slate-50 text-slate-600"
      : requirementMet
        ? "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-[0_16px_40px_rgba(16,185,129,0.14)]"
        : "border-amber-200 bg-amber-50 text-amber-800 shadow-[0_16px_40px_rgba(245,158,11,0.12)]";

  return (
    <div className="mt-6 overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-white shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
      <div className="h-[3px] w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />

      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="fca-eyebrow">Team Übersicht</p>
            <p className="mt-1 text-sm font-black text-slate-900">Saison {seasonLabel}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Total: {playerCount} Spieler · {trainerCount} Trainer
            </p>
          </div>

          <div className="flex max-w-xl flex-wrap justify-end gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 shadow-sm">
              {playerCount} Spieler
            </span>
            <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-black text-[#0b4aa2] shadow-sm">
              {trainerCount} Trainer
            </span>
            <span className={"inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black shadow-sm " + ratioState.className}>
              <span className={"h-2 w-2 rounded-full " + ratioState.dotClassName} />
              <span>{ratioState.label}</span>
              <span className="font-semibold opacity-80">{ratioState.description}</span>
            </span>
            {requirementLabel ? (
              <span className={"inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black " + diplomaClass}>
                {requirementMet ? <CheckCircle2 className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                <span>{requirementMet ? "Diplom erfüllt" : "Diplom prüfen"}</span>
                <span className="font-semibold opacity-85">Soll: {requirementLabel}</span>
                {showFulfillmentExplanation ? <span className="font-black">· {fulfilledByLabel} deckt ab</span> : null}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-slate-400">Spieler nach Jahrgang</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {birthYears.length > 0 ? (
                birthYears.map((item) => (
                  <span key={item.year} className="inline-flex flex-col rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs shadow-sm">
                    <span className="font-black text-[#0b4aa2]">{item.year}</span>
                    <span className="font-bold text-slate-500">{item.count} Spieler</span>
                  </span>
                ))
              ) : (
                <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-500 shadow-sm">
                  Keine Jahrgangsdaten
                </span>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-400">Trainerlizenzen</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {sortedDiplomas.length > 0 ? (
                sortedDiplomas.map((item) => {
                  const coversRequirement = requirementMet && fulfilledByLabel === item.label;

                  return (
                    <span key={item.label} className={"inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black shadow-sm " + (coversRequirement ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-blue-100 bg-blue-50 text-[#0b4aa2]")}>
                      <span>🎓</span>
                      <span>{item.label}: {item.count}</span>
                      {coversRequirement ? <ShieldCheck className="h-3.5 w-3.5" /> : null}
                    </span>
                  );
                })
              ) : (
                <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-500 shadow-sm">
                  Keine Diplome erfasst
                </span>
              )}
            </div>
          </div>
        </div>

        {showFulfillmentExplanation ? (
          <div className="mt-5 rounded-[22px] border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-800">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-black">Warum ist das Diplom erfüllt?</p>
                <p className="mt-1 text-xs font-semibold leading-5">
                  Für diese Teamkategorie ist {requirementLabel} erforderlich. {fulfilledByLabel} ist höher eingestuft und erfüllt diese Anforderung.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
