"use client";

import { useMemo, useState, useTransition } from "react";
import { RefreshCw, Save, ShieldCheck, SlidersHorizontal, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  AdminActionListCard,
  AdminFormCard,
  AdminFormField,
  AdminInlineStatusMessage,
} from "@/components/admin/shared/form";

type SeasonOption = { id: string; key: string; name: string; isActive: boolean };
type TeamSeasonOption = { id: string; displayName: string; shortName: string | null; teamName: string; seasonId: string; seasonName: string; seasonKey: string };
type RoleOption = { id: string; key: string; name: string };
type AllowedRaterPreview = { teamSeasonId: string; trainerPermissionActive: boolean; trainerNames: string[]; roleRaters: { roleId: string; roleName: string; names: string[] }[] };

type RatingPermission = {
  id: string;
  teamSeasonId: string;
  seasonId: string;
  roleId: string | null;
  label: string | null;
  isActive: boolean;
  includeTeamTrainers: boolean;
  teamSeason: {
    displayName: string;
    shortName: string | null;
    team: { name: string };
    season: { name: string; key: string; isActive: boolean };
  };
  role: { id: string; key: string; name: string } | null;
};

type RatingArea = {
  id: string;
  seasonId: string | null;
  key: string;
  label: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  season: { id: string; key: string; name: string; isActive: boolean } | null;
};

type Props = {
  seasons: SeasonOption[];
  teamSeasons: TeamSeasonOption[];
  roles: RoleOption[];
  permissions: RatingPermission[];
  areas: RatingArea[];
  people?: unknown[];
  allowedRaterPreview?: AllowedRaterPreview[];
};

function getPermissionLabel(permission: RatingPermission) {
  if (permission.includeTeamTrainers) return "Trainerteam dieser Team-Saison";
  if (permission.role) return permission.role.name;
  return "Admin only";
}


function AllowedRaterPreviewCard({ preview }: { preview?: AllowedRaterPreview }) {
  if (!preview) return null;

  const hasTrainerNames = preview.trainerNames.length > 0;
  const hasRoleNames = preview.roleRaters.some((roleRater) => roleRater.names.length > 0);

  return (
    <div className="mb-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#0b4aa2]">Aktuelle Bewerter</p>

      <div className="mt-2 space-y-2">
        <div>
          <p className="text-xs font-bold text-slate-700">
            Trainerteam {preview.trainerPermissionActive ? "aktiv" : "deaktiviert"}
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
            {preview.trainerPermissionActive
              ? hasTrainerNames
                ? preview.trainerNames.join(", ")
                : "Keine aktiven Trainer zugeordnet"
              : "Trainer dürfen aktuell nicht bewerten"}
          </p>
        </div>

        {preview.roleRaters.length > 0 ? (
          <div className="space-y-1">
            {preview.roleRaters.map((roleRater) => (
              <div key={roleRater.roleId}>
                <p className="text-xs font-bold text-slate-700">{roleRater.roleName}</p>
                <p className="text-xs font-semibold leading-5 text-slate-500">
                  {roleRater.names.length > 0 ? roleRater.names.join(", ") : "Keine aktiven Benutzer mit dieser Rolle"}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {!preview.trainerPermissionActive && !hasRoleNames ? (
          <p className="text-xs font-semibold text-slate-500">Nur Admin/Superadmin darf bewerten.</p>
        ) : null}
      </div>
    </div>
  );
}
export default function RatingGovernanceCard({ seasons, teamSeasons, roles, permissions, areas, allowedRaterPreview = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [permissionTeamSeasonId, setPermissionTeamSeasonId] = useState(teamSeasons[0]?.id ?? "");
  const [permissionMode, setPermissionMode] = useState<"trainers" | "role">("trainers");
  const [permissionRoleId, setPermissionRoleId] = useState("");
  const [permissionLabel, setPermissionLabel] = useState("");
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);

  const [areaSeasonId, setAreaSeasonId] = useState("");
  const [areaLabel, setAreaLabel] = useState("");
  const [areaDescription, setAreaDescription] = useState("");
  const [areaSortOrder, setAreaSortOrder] = useState("0");
  const [areaError, setAreaError] = useState<string | null>(null);
  const [areaMessage, setAreaMessage] = useState<string | null>(null);

  const groupedPermissions = useMemo(() => {
    return permissions.reduce<Record<string, RatingPermission[]>>((acc, permission) => {
      const key = `${permission.teamSeason.team.name} · ${permission.teamSeason.season.name}`;
      acc[key] = acc[key] ?? [];
      acc[key].push(permission);
      return acc;
    }, {});
  }, [permissions]);

  async function createPermission() {
    setPermissionError(null);
    setPermissionMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/rating-permissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamSeasonId: permissionTeamSeasonId,
            includeTeamTrainers: permissionMode === "trainers",
            roleId: permissionMode === "role" ? permissionRoleId : null,
            label: permissionLabel,
            isActive: true,
          }),
        });

        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error ?? "Bewertungsrecht konnte nicht gespeichert werden.");

        setPermissionMessage(data?.message ?? "Bewertungsrecht gespeichert.");
        setPermissionLabel("");
        router.refresh();
      } catch (error) {
        setPermissionError(error instanceof Error ? error.message : "Bewertungsrecht konnte nicht gespeichert werden.");
      }
    });
  }

  async function updatePermission(permission: RatingPermission, isActive: boolean) {
    startTransition(async () => {
      const response = await fetch(`/api/admin/rating-permissions/${permission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: permission.label ?? "", isActive }),
      });
      if (response.ok) router.refresh();
    });
  }

  async function deletePermission(permissionId: string) {
    startTransition(async () => {
      const response = await fetch(`/api/admin/rating-permissions/${permissionId}`, { method: "DELETE" });
      if (response.ok) router.refresh();
    });
  }

  async function createArea() {
    setAreaError(null);
    setAreaMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/rating-areas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seasonId: areaSeasonId || null,
            label: areaLabel,
            description: areaDescription,
            sortOrder: Number(areaSortOrder),
            isActive: true,
          }),
        });

        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error ?? "Bewertungsbereich konnte nicht gespeichert werden.");

        setAreaMessage(data?.message ?? "Bewertungsbereich gespeichert.");
        setAreaLabel("");
        setAreaDescription("");
        setAreaSortOrder("0");
        router.refresh();
      } catch (error) {
        setAreaError(error instanceof Error ? error.message : "Bewertungsbereich konnte nicht gespeichert werden.");
      }
    });
  }

  async function updateArea(area: RatingArea, isActive: boolean) {
    startTransition(async () => {
      const response = await fetch(`/api/admin/rating-areas/${area.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: area.label, description: area.description ?? "", sortOrder: area.sortOrder, isActive }),
      });
      if (response.ok) router.refresh();
    });
  }

  async function deleteArea(areaId: string) {
    startTransition(async () => {
      const response = await fetch(`/api/admin/rating-areas/${areaId}`, { method: "DELETE" });
      if (response.ok) router.refresh();
    });
  }

  return (
    <div className="w-full max-w-full overflow-hidden rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="fca-eyebrow">Bewertungsrechte</p>
          <h2 className="mt-2 text-xl font-black text-slate-900">Spielerbewertungen steuern</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
            Standard: nur Admin. Optional können Trainer der Team-Saison und/oder ausgewählte Rollen bewerten.
          </p>
        </div>
        <ShieldCheck className="h-6 w-6 shrink-0 text-[#0b4aa2]" />
      </div>

      <div className="mt-5">
        <AdminInlineStatusMessage>
          Admins dürfen immer bewerten. Personen werden nicht einzeln berechtigt.
        </AdminInlineStatusMessage>
      </div>

      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-2">
        <AdminFormCard title="Rechte hinzufügen" icon={<ShieldCheck className="h-5 w-5" />}>
          <div className="grid gap-4">
            <AdminFormField label="Team / Saison">
              <select className="fca-select w-full max-w-full" value={permissionTeamSeasonId} onChange={(event) => setPermissionTeamSeasonId(event.target.value)}>
                {teamSeasons.map((teamSeason) => (
                  <option key={teamSeason.id} value={teamSeason.id}>
                    {teamSeason.teamName} · {teamSeason.seasonName}
                  </option>
                ))}
              </select>
            </AdminFormField>

            <AdminFormField label="Freigabe">
              <select className="fca-select w-full max-w-full" value={permissionMode} onChange={(event) => setPermissionMode(event.target.value as "trainers" | "role")}>
                <option value="trainers">+ Trainerteam dieser Team-Saison</option>
                <option value="role">+ Bestimmte Rolle</option>
              </select>
            </AdminFormField>

            {permissionMode === "role" ? (
              <AdminFormField label="Rolle">
                <select className="fca-select w-full max-w-full" value={permissionRoleId} onChange={(event) => setPermissionRoleId(event.target.value)}>
                  <option value="">Bitte auswählen</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </AdminFormField>
            ) : null}

            <AdminFormField label="Bemerkung">
              <input className="fca-input w-full max-w-full" value={permissionLabel} onChange={(event) => setPermissionLabel(event.target.value)} placeholder="z.B. Haupttrainer, Koordinator, Sichtung" />
            </AdminFormField>

            {permissionError ? <AdminInlineStatusMessage tone="error">{permissionError}</AdminInlineStatusMessage> : null}
            {permissionMessage ? <AdminInlineStatusMessage tone="success">{permissionMessage}</AdminInlineStatusMessage> : null}

            <button type="button" onClick={createPermission} disabled={isPending} className="fca-button-primary w-fit">
              <Save className="h-4 w-4" />
              Bewertungsrecht speichern
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {Object.entries(groupedPermissions).length === 0 ? (
              <AdminActionListCard emptyText="Nur Admins dürfen bewerten. Keine zusätzlichen Freigaben erfasst." />
            ) : (
              Object.entries(groupedPermissions).map(([group, entries]) => (
                <AdminActionListCard key={group} title={group} emptyText="">
                  {entries.map((permission) => (
                    <div key={permission.id} className="flex min-w-0 flex-col gap-3 rounded-xl bg-slate-50 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">{getPermissionLabel(permission)}</p>
                        <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                          {permission.label ?? "Ohne Bemerkung"} · {permission.isActive ? "Aktiv" : "Inaktiv"}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button type="button" onClick={() => updatePermission(permission, !permission.isActive)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
                          {permission.isActive ? "Deaktivieren" : "Aktivieren"}
                        </button>
                        <button type="button" onClick={() => deletePermission(permission.id)} className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </AdminActionListCard>
              ))
            )}
          </div>
        </AdminFormCard>

        <AdminFormCard title="Bewertungsbereiche" icon={<SlidersHorizontal className="h-5 w-5" />}>
          <div className="grid gap-4">
            <AdminFormField label="Saison optional">
              <select className="fca-select w-full max-w-full" value={areaSeasonId} onChange={(event) => setAreaSeasonId(event.target.value)}>
                <option value="">Global</option>
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>{season.name}</option>
                ))}
              </select>
            </AdminFormField>

            <AdminFormField label="Bereich">
              <input className="fca-input w-full max-w-full" value={areaLabel} onChange={(event) => setAreaLabel(event.target.value)} placeholder="z.B. Technik, Mentalität, Sozialverhalten" />
            </AdminFormField>

            <AdminFormField label="Beschreibung">
              <input className="fca-input w-full max-w-full" value={areaDescription} onChange={(event) => setAreaDescription(event.target.value)} placeholder="Kurze Beschreibung" />
            </AdminFormField>

            <AdminFormField label="Sortierung">
              <input className="fca-input w-full max-w-full" type="number" value={areaSortOrder} onChange={(event) => setAreaSortOrder(event.target.value)} />
            </AdminFormField>

            {areaError ? <AdminInlineStatusMessage tone="error">{areaError}</AdminInlineStatusMessage> : null}
            {areaMessage ? <AdminInlineStatusMessage tone="success">{areaMessage}</AdminInlineStatusMessage> : null}

            <button type="button" onClick={createArea} disabled={isPending} className="fca-button-primary w-fit">
              <Save className="h-4 w-4" />
              Bereich speichern
            </button>
          </div>

          <div className="mt-6">
            {areas.length === 0 ? (
              <AdminActionListCard emptyText="Noch keine Bewertungsbereiche erfasst." />
            ) : (
              <AdminActionListCard emptyText="">
                {areas.map((area) => (
                  <div key={area.id} className="flex min-w-0 flex-col gap-3 rounded-xl bg-slate-50 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{area.label}</p>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                        {area.season?.name ?? "Global"} · {area.description ?? "Keine Beschreibung"} · {area.isActive ? "Aktiv" : "Inaktiv"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button type="button" onClick={() => updateArea(area, !area.isActive)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
                        {area.isActive ? "Deaktivieren" : "Aktivieren"}
                      </button>
                      <button type="button" onClick={() => deleteArea(area.id)} className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </AdminActionListCard>
            )}
          </div>
        </AdminFormCard>
      </div>

      <div className="mt-5">
        <AdminInlineStatusMessage>
          <span className="inline-flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Änderungen werden nach dem Speichern automatisch in den Spielerprofilen sichtbar.
          </span>
        </AdminInlineStatusMessage>
      </div>
    </div>
  );
}





