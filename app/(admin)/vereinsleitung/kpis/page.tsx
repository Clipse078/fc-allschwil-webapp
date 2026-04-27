"use client";

import { useEffect, useState } from "react";

type TeamHealth = {
  teamId: string;
  teamName: string;
  category: string | null;
  requiredDiploma: string;
  hasRequired: boolean;
};

type KPIResponse = {
  summary: {
    total: number;
    compliant: number;
    nonCompliant: number;
  };
  teams: TeamHealth[];
};

export default function VereinsleitungKPIsPage() {
  const [data, setData] = useState<KPIResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/kpis/team-health")
      .then((res) => res.json())
      .then((json) => setData(json))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6">Lade KPI...</div>;
  if (!data) return <div className="p-6">Keine Daten verfügbar</div>;

  const ratio = data.summary.total ? Math.round((data.summary.compliant / data.summary.total) * 100) : 0;
  const openTeams = data.teams.filter((team) => !team.hasRequired);

  return (
    <div className="space-y-8 p-6">
      <div>
        <p className="fca-eyebrow">Vereinsleitung</p>
        <h1 className="text-3xl font-black text-[#0b4aa2]">Trainer-Diplom Übersicht</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 shadow">
          <div className="text-xs text-slate-400">Teams gesamt</div>
          <div className="text-2xl font-black">{data.summary.total}</div>
        </div>
        <div className="rounded-2xl bg-green-50 p-4 shadow">
          <div className="text-xs text-slate-400">Erfüllt</div>
          <div className="text-2xl font-black text-green-700">{data.summary.compliant}</div>
        </div>
        <div className="rounded-2xl bg-orange-50 p-4 shadow">
          <div className="text-xs text-slate-400">Offen</div>
          <div className="text-2xl font-black text-orange-600">{data.summary.nonCompliant}</div>
        </div>
        <div className="rounded-2xl bg-blue-50 p-4 shadow">
          <div className="text-xs text-slate-400">Quote</div>
          <div className="text-2xl font-black text-[#0b4aa2]">{ratio}%</div>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold text-slate-900">Offene Teams</h2>
        {openTeams.length === 0 ? (
          <div className="font-semibold text-green-600">Alle Teams erfüllen die Anforderungen ✅</div>
        ) : (
          <div className="space-y-2">
            {openTeams.map((team) => (
              <div key={team.teamId} className="flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
                <div className="font-semibold">{team.teamName}</div>
                <div className="text-sm text-orange-700">{team.requiredDiploma} fehlt</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
