"use client";

import { useEffect, useMemo, useState } from "react";

type QualificationRequirement = {
  requiredDiploma: string | null;
  requiredTrainerCount: number;
  matchingTrainerCount: number;
  isFulfilled: boolean;
};

type TeamHealthResult = {
  teamId: string;
  teamName: string;
  category: string | null;
  ageGroup: string | null;
  requiredTrainerCount: number | null;
  matchedRuleCategory: string | null;
  qualificationRequirements: QualificationRequirement[];
  hasEnoughTrainers: boolean;
  trainerCount: number;
  status: "healthy" | "attention";
};

type TeamHealthResponse = {
  summary: {
    total: number;
    compliant: number;
    nonCompliant: number;
    missingRule: number;
  };
  teams: TeamHealthResult[];
};

function RequirementBadge({ requirement }: { requirement: QualificationRequirement }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
        requirement.isFulfilled
          ? "border-emerald-100 bg-emerald-50 text-emerald-700"
          : "border-red-100 bg-red-50 text-red-700"
      }`}
    >
      <span>{requirement.isFulfilled ? "OK" : "!"}</span>
      <span>{requirement.requiredDiploma ?? "Diploma rule"}</span>
      <span className="opacity-75">
        {requirement.matchingTrainerCount}/{requirement.requiredTrainerCount}
      </span>
    </span>
  );
}

export default function VereinsleitungKpisPage() {
  const [data, setData] = useState<TeamHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTeamHealth() {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const response = await fetch("/api/kpis/team-health", { cache: "no-store" });

        if (!response.ok) {
          throw new Error(`Team health KPI could not be loaded (${response.status})`);
        }

        const payload = (await response.json()) as TeamHealthResponse;

        if (isMounted) setData(payload);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "Team health KPI could not be loaded.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadTeamHealth();

    return () => {
      isMounted = false;
    };
  }, []);

  const attentionTeams = useMemo(
    () => data?.teams.filter((team) => team.status === "attention") ?? [],
    [data],
  );

  if (isLoading) {
    return (
      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">Loading team health KPIs...</p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="rounded-[30px] border border-red-100 bg-red-50 p-6 text-red-700 shadow-sm">
        <p className="text-sm font-bold">KPI loading failed</p>
        <p className="mt-1 text-sm">{errorMessage}</p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-4">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Teams</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{data?.summary.total ?? 0}</p>
        </section>

        <section className="rounded-[28px] border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Compliant</p>
          <p className="mt-2 text-3xl font-black text-emerald-800">{data?.summary.compliant ?? 0}</p>
        </section>

        <section className="rounded-[28px] border border-red-100 bg-red-50 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-600">Needs attention</p>
          <p className="mt-2 text-3xl font-black text-red-800">{data?.summary.nonCompliant ?? 0}</p>
        </section>

        <section className="rounded-[28px] border border-amber-100 bg-amber-50 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Missing rules</p>
          <p className="mt-2 text-3xl font-black text-amber-800">{data?.summary.missingRule ?? 0}</p>
        </section>
      </div>

      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-600">Vereinsleitung KPI</p>
          <h3 className="mt-1 text-xl font-black text-[#0b4aa2]">Trainer qualification health</h3>
          <p className="mt-1 text-sm text-slate-500">
            Shows required diplomas per team, fulfilment count and teams requiring action.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {(data?.teams ?? []).map((team) => (
            <div key={team.teamId} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">{team.teamName}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {team.category ?? "No category"} - {team.trainerCount} trainers - Rule:{" "}
                    {team.matchedRuleCategory ?? "missing"}
                  </p>
                </div>

                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-black ${
                    team.status === "healthy"
                      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                      : "border-red-100 bg-red-50 text-red-700"
                  }`}
                >
                  {team.status === "healthy" ? "Healthy" : "Attention"}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {team.qualificationRequirements.length > 0 ? (
                  team.qualificationRequirements.map((requirement, index) => (
                    <RequirementBadge
                      key={`${team.teamId}-${requirement.requiredDiploma ?? "rule"}-${index}`}
                      requirement={requirement}
                    />
                  ))
                ) : (
                  <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
                    No qualification rule configured
                  </span>
                )}

                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                    team.hasEnoughTrainers
                      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                      : "border-red-100 bg-red-50 text-red-700"
                  }`}
                >
                  Trainers {team.trainerCount}/{team.requiredTrainerCount ?? "?"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {attentionTeams.length > 0 ? (
        <section className="rounded-[30px] border border-red-100 bg-red-50 p-5 shadow-sm">
          <p className="text-sm font-black text-red-800">Action list</p>
          <p className="mt-1 text-sm text-red-700">
            {attentionTeams.length} team(s) need review for trainer count, diploma requirements or missing rule configuration.
          </p>
        </section>
      ) : null}
    </div>
  );
}