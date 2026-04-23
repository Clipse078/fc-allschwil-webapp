"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  CircleDot,
  GitBranch,
  Layers3,
  Minus,
  Network,
  Plus,
  Settings2,
  Sparkles,
  UserRound,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type {
  OrganigrammOverview,
  OrganigrammRoleNode,
} from "@/lib/vereinsleitung/organigramm";

type VereinsleitungOrganigrammClientProps = {
  overview: OrganigrammOverview;
  canManage: boolean;
};

type BuilderDepartment = {
  id: string;
  title: string;
  description: string;
  accentFrom: string;
  accentVia: string;
  accentTo: string;
  roles: OrganigrammRoleNode[];
};

function getInitials(value: string) {
  const parts = value.split(" ").filter(Boolean).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "--";
}

function RolePill({ role }: { role: OrganigrammRoleNode }) {
  const firstPerson = role.people[0];

  return (
    <div className="group flex items-center justify-between gap-3 rounded-[18px] border border-slate-200 bg-white/92 px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition hover:-translate-y-[1px] hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)]">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-900">{role.title}</div>
        <div className="mt-1 truncate text-xs text-slate-500">
          {firstPerson ? firstPerson.name : "Noch nicht zugewiesen"}
        </div>
      </div>

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50 text-xs font-semibold text-[#0b4aa2]">
        {firstPerson ? firstPerson.initials : getInitials(role.title)}
      </div>
    </div>
  );
}

function DepartmentBubble({
  department,
  index,
}: {
  department: BuilderDepartment;
  index: number;
}) {
  return (
    <article
      className={`relative mx-auto flex min-h-[320px] w-full max-w-[430px] flex-col rounded-[36px] border border-slate-200 bg-white/95 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.10)] ${
        index === 0 ? "lg:col-span-2 lg:max-w-[480px]" : ""
      }`}
    >
      <div
        className="absolute inset-x-7 top-0 h-[4px] rounded-full"
        style={{
          backgroundImage: `linear-gradient(to right, ${department.accentFrom}, ${department.accentVia}, ${department.accentTo})`,
        }}
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-red-600">
            Bereich
          </p>
          <h2 className="mt-2 text-[1.45rem] font-bold tracking-[-0.03em] text-[#0b4aa2]">
            {department.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {department.description || "Flexibler Organisationsbereich"}
          </p>
        </div>

        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[#0b4aa2] shadow-sm">
          <Building2 className="h-6 w-6" />
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {department.roles.length > 0 ? (
          department.roles.slice(0, 6).map((role) => <RolePill key={role.id} role={role} />)
        ) : (
          <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
            Noch keine Rollen in diesem Bereich.
          </div>
        )}
      </div>

      {department.roles.length > 6 ? (
        <div className="mt-4 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-600">
          + {department.roles.length - 6} weitere Rollen
        </div>
      ) : null}
    </article>
  );
}

export default function VereinsleitungOrganigrammClient({
  overview,
  canManage,
}: VereinsleitungOrganigrammClientProps) {
  const [zoom, setZoom] = useState(100);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(
    overview.departments[0]?.id ?? "",
  );

  const departments = useMemo<BuilderDepartment[]>(() => { if (!overview.departments || overview.departments.length === 0) { return [{ id: "demo-vereinsleitung", title: "Vereinsleitung", description: "Strategische Führung, Governance und langfristige Vereinsentwicklung.", accentFrom: "#0b4aa2", accentVia: "#6a5acd", accentTo: "#d62839", roles: [] }, { id: "demo-betrieb", title: "Betrieb & Organisation", description: "Operative Vereinsprozesse, Tagesgeschäft, Events und Support.", accentFrom: "#0b4aa2", accentVia: "#38bdf8", accentTo: "#6a5acd", roles: [] }, { id: "demo-tk", title: "Technische Kommission", description: "Sportliche Führung, Ausbildung und technische Verantwortung.", accentFrom: "#64748b", accentVia: "#0b4aa2", accentTo: "#d62839", roles: [] }]; } return overview.departments.map((department) => ({
      id: department.id,
      title: department.title,
      description: department.description ?? "",
      accentFrom: department.accent.from,
      accentVia: department.accent.via,
      accentTo: department.accent.to,
      roles: department.roles,
    }));
  }, [overview.departments]);

  const triangleDepartments = departments.slice(0, 3);
  const remainingDepartments = departments.slice(3);

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-[0_22px_50px_rgba(15,23,42,0.07)]">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />

        <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)] lg:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">
              Organigramm Builder
            </p>
            <h1 className="mt-3 text-[2.2rem] font-bold uppercase tracking-[-0.04em] text-[#0b4aa2]">
              Vereinsstruktur visuell planen
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
              Flexibler, white-label-fähiger Organigramm-Baukasten für Bereiche, Rollen und
              Personen. Die Struktur ist bewusst nicht hart auf FCA fixiert, damit sie später auch
              für VereinsOS-Kunden wiederverwendbar ist.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700">
                <Sparkles className="h-4 w-4 text-[#0b4aa2]" />
                Premium Canvas
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700">
                <GitBranch className="h-4 w-4 text-[#0b4aa2]" />
                Hierarchie & Rollen
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700">
                <Layers3 className="h-4 w-4 text-[#0b4aa2]" />
                White-label ready
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Bereiche
              </p>
              <p className="mt-3 text-[2rem] font-semibold text-slate-900">
                {overview.stats.departmentCount}
              </p>
            </div>
            <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Rollen
              </p>
              <p className="mt-3 text-[2rem] font-semibold text-slate-900">
                {overview.stats.roleCount}
              </p>
            </div>
            <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Personen
              </p>
              <p className="mt-3 text-[2rem] font-semibold text-slate-900">
                {overview.stats.assignedCardsCount}
              </p>
            </div>
            <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Modus
              </p>
              <p className="mt-3 text-lg font-semibold text-slate-900">Builder</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[#0b4aa2]">
                <Network className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Canvas Ansicht</p>
                <p className="text-xs text-slate-500">Dreiecksstruktur mit Bereichen und Rollen</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoom((value) => Math.max(80, value - 10))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                {zoom}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((value) => Math.min(120, value + 10))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            className="min-h-[760px] overflow-auto bg-[radial-gradient(circle_at_1px_1px,#cbd5e1_1px,transparent_0)] p-8 [background-size:24px_24px]"
          >
            <div
              className="mx-auto origin-top transition-transform"
              style={{ transform: `scale(${zoom / 100})`, width: `${10000 / zoom}%` }}
            >
              <div className="mx-auto flex max-w-[1200px] flex-col items-center">
                <div className="relative flex h-44 w-44 items-center justify-center rounded-full border border-slate-200 bg-gradient-to-br from-[#0b4aa2] via-[#6a5acd] to-[#d62839] text-center text-white shadow-[0_24px_60px_rgba(11,74,162,0.25)]">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">
                      Verein
                    </div>
                    <div className="mt-2 text-xl font-bold">FC Allschwil</div>
                    <div className="mt-1 text-xs opacity-80">Organisation</div>
                  </div>
                </div>

                <div className="h-14 w-px bg-slate-300" />

                <div className="mb-10 flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
                  <CircleDot className="h-4 w-4 text-[#0b4aa2]" />
                  <span className="text-sm font-semibold text-slate-700">
                    Strategische und operative Bereiche
                  </span>
                </div>

                <div className="grid w-full gap-8 lg:grid-cols-2">
                  {triangleDepartments.map((department, index) => (
                    <DepartmentBubble
                      key={department.id}
                      department={department}
                      index={index}
                    />
                  ))}
                </div>

                {remainingDepartments.length > 0 ? (
                  <div className="mt-10 grid w-full gap-6 lg:grid-cols-3">
                    {remainingDepartments.map((department, index) => (
                      <DepartmentBubble
                        key={department.id}
                        department={department}
                        index={index + 3}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
            <div className="h-1.5 w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />
            <div className="p-5">
              <div className="flex items-center gap-3">
                <Settings2 className="h-5 w-5 text-[#0b4aa2]" />
                <h2 className="text-lg font-semibold text-slate-900">Builder Panel</h2>
              </div>

              <div className="mt-5 space-y-5">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Neuer Bereich
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={newDepartmentName}
                      onChange={(event) => setNewDepartmentName(event.target.value)}
                      placeholder="z. B. Sponsoring"
                      className="fca-input"
                    />
                    <button
                      type="button"
                      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[#0b4aa2] hover:bg-slate-50"
                      title="Bereich hinzufügen"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Nächster Schritt: Persistenz via Datenbank-API, damit diese Änderungen gespeichert
                    werden.
                  </p>
                </div>

                <div className="border-t border-slate-200 pt-5">
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Neue Rolle
                  </label>
                  <select
                    value={selectedDepartmentId}
                    onChange={(event) => setSelectedDepartmentId(event.target.value)}
                    className="mt-2 fca-input"
                  >
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.title}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={newRoleName}
                      onChange={(event) => setNewRoleName(event.target.value)}
                      placeholder="z. B. Medienleitung"
                      className="fca-input"
                    />
                    <button
                      type="button"
                      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[#0b4aa2] hover:bg-slate-50"
                      title="Rolle hinzufügen"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {!canManage ? (
                  <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Du kannst das Organigramm ansehen. Bearbeiten benötigt Adminrechte.
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-[30px] border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center gap-3">
              <UserRound className="h-5 w-5 text-[#0b4aa2]" />
              <h2 className="text-lg font-semibold text-slate-900">White-label Logik</h2>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Dieses Modul arbeitet mit generischen Bereichen, Rollen und Personen. FCA ist nur die
              aktuelle Instanz. Später kann VereinsOS dieselbe Struktur pro Kunde mit eigenem Logo,
              Farben und Rollenmodell nutzen.
            </p>
          </section>
        </aside>
      </section>
    </div>
  );
}