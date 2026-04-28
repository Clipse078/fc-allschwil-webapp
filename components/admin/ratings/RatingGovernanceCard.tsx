"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, RefreshCw, Save, ShieldCheck, SlidersHorizontal, Trash2, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  AdminActionListCard,
  AdminFormCard,
  AdminFormField,
  AdminInlineStatusMessage,
} from "@/components/admin/shared/form";

type SeasonOption = { id: string; key: string; name: string; isActive: boolean };

type TeamSeasonOption = {
  id: string;
  displayName?: string;
  shortName?: string | null;
  teamName: string;
  seasonId?: string;
  seasonName: string;
  seasonKey?: string;
  seasonIsActive?: boolean;
};

type RoleOption = { id: string; key?: string; name: string };

type AllowedRaterPreview = {
  teamSeasonId: string;
  trainerPermissionActive: boolean;
  trainerNames: string[];
  roleRaters: { roleId: string; roleName: string; names: string[] }[];
};

type RatingPermission = {
  id: string;
  teamSeasonId: string;
  seasonId?: string;
  roleId: string | null;
  label: string | null;
  isActive: boolean;
  includeTeamTrainers: boolean;
  teamSeason?: {
    displayName: string;
    shortName: string | null;
    team: { name: string };
    season: { name: string; key: string; isActive: boolean };
  };
  role: { id: string; key?: string; name: string } | null;
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

const EXCLUDED_ROLE_KEYS = new Set(["ADMIN", "SUPERADMIN", "PLAYER", "SPIELER"]);

function permissionTitle(permission: RatingPermission) {
  if (permission.includeTeamTrainers) return "Trainerteam";
  if (permission.role) return permission.role.name;
  return "Admin";
}

function activePermissionsForTeamSeason(permissions: RatingPermission[], teamSeasonId: string) {
  return permissions.filter((permission) => permission.teamSeasonId === teamSeasonId && permission.isActive);
}

export default function RatingGovernanceCard({
  seasons,
  teamSeasons,
  roles,
  permissions,
  areas,
  allowedRaterPreview = [],
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const assignableRoles = useMemo(() => {
    return roles.filter((role) => !EXCLUDED_ROLE_KEYS.has((role.key ?? "").toUpperCase()));
  }, [roles]);

  const [areaSeasonId, setAreaSeasonId] = useState("");
  const [areaLabel, setAreaLabel] = useState("");
  const [areaDescription, setAreaDescription] = useState("");
  const [areaSortOrder, setAreaSortOrder] = useState("0");
  const [areaError, setAreaError] = useState<string | null>(null);
  const [areaMessage, setAreaMessage] = useState<string | null>(null);
  const [controlMessage, setControlMessage] = useState<string | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);

  function previewForTeamSeason(teamSeasonId: string) {
    return allowedRaterPreview.find((preview) => preview.teamSeasonId === teamSeasonId);
  }

  async function deletePermissionById(permissionId: string) {
    const response = await fetch(`/api/admin/rating-permissions/${permissionId}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error ?? "Bewertungsrecht konnte nicht entfernt werden.");
    }
  }

  async function createPermission(input: { teamSeasonId: string; includeTeamTrainers: boolean; roleId?: string | null; label?: string | null }) {
    const response = await fetch("/api/admin/rating-permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamSeasonId: input.teamSeasonId,
        includeTeamTrainers: input.includeTeamTrainers,
        roleId: input.roleId ?? null,
        label: input.label ?? null,
        isActive: true,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error ?? "Bewertungsrecht konnte nicht gespeichert werden.");
    }
  }

  async function toggleTrainerPermission(teamSeasonId: string, enabled: boolean) {
    setControlError(null);
    setControlMessage(null);

    startTransition(async () => {
      try {
        const existingTrainerPermissions = permissions.filter(
          (permission) => permission.teamSeasonId === teamSeasonId && permission.includeTeamTrainers
        );

        if (enabled && existingTrainerPermissions.length === 0) {
          await createPermission({ teamSeasonId, includeTeamTrainers: true, label: "Trainerteam" });
        }

        if (!enabled) {
          for (const permission of existingTrainerPermissions) {
            await deletePermissionById(permission.id);
          }
        }

        setControlMessage("Bewertungsrecht aktualisiert.");
        router.refresh();
      } catch (error) {
        setControlError(error instanceof Error ? error.message : "Bewertungsrecht konnte nicht aktualisiert werden.");
      }
    });
  }

  async function toggleRolePermission(teamSeasonId: string, role: RoleOption, enabled: boolean) {
    setControlError(null);
    setControlMessage(null);

    startTransition(async () => {
      try {
        const existingRolePermissions = permissions.filter(
          (permission) => permission.teamSeasonId === teamSeasonId && permission.roleId === role.id
        );

        if (enabled && existingRolePermissions.length === 0) {
          await createPermission({
            teamSeasonId,
            includeTeamTrainers: false,
            roleId: role.id,
            label: role.name,
          });
        }

        if (!enabled) {
          for (const permission of existingRolePermissions) {
            await deletePermissionById(permission.id);
          }
        }

        setControlMessage("Zusatzrolle aktualisiert.");
        router.refresh();
      } catch (error) {
        setControlError(error instanceof Error ? error.message : "Zusatzrolle konnte nicht aktualisiert werden.");
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
            Admins bleiben immer berechtigt. Zusätzliche Bewerter werden pro Team-Saison gesteuert.
          </p>
        </div>
        <div className="rounded-2xl bg-blue-50 p-3">
          <ShieldCheck className="h-6 w-6 shrink-0 text-[#0b4aa2]" />
        </div>
      </div>

      <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0b4aa2]">Team-Saison Steuerung</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">Trainerteam toggeln, eine oder mehrere Zusatzrollen auswählen.</p>
          </div>
          {(controlError || controlMessage) ? (
            <div className="lg:max-w-md">
              {controlError ? <AdminInlineStatusMessage tone="error">{controlError}</AdminInlineStatusMessage> : null}
              {controlMessage ? <AdminInlineStatusMessage tone="success">{controlMessage}</AdminInlineStatusMessage> : null}
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {teamSeasons.map((teamSeason) => {
            const activePermissions = activePermissionsForTeamSeason(permissions, teamSeason.id);
            const trainerEnabled = activePermissions.some((permission) => permission.includeTeamTrainers);
            const activeRolePermissions = activePermissions.filter((permission) => permission.roleId);
            const preview = previewForTeamSeason(teamSeason.id);
            const hasAnyRater = trainerEnabled || activeRolePermissions.length > 0;
            const seasonLocked = teamSeason.seasonIsActive === false;

            return (
              <div key={teamSeason.id} className={`rounded-[24px] border bg-white p-4 shadow-sm transition ${hasAnyRater ? "border-blue-100 ring-1 ring-blue-50" : "border-slate-200"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900">{teamSeason.teamName}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{teamSeason.seasonName}</p>{seasonLocked ? <p className="mt-2 w-fit rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-red-600">Saison abgeschlossen · Bewertungen gesperrt</p> : <p className="mt-2 w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-700">Bewertungen offen</p>}
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-black ${hasAnyRater ? "bg-blue-50 text-[#0b4aa2]" : "bg-slate-100 text-slate-500"}`}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {seasonLocked ? "Saison gesperrt" : hasAnyRater ? "Freigabe aktiv" : "Admin only"}
                  </span>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    disabled={isPending || seasonLocked}
                    onClick={() => toggleTrainerPermission(teamSeason.id, !trainerEnabled)}
                    className={`inline-flex w-fit items-center justify-center rounded-full px-4 py-2 text-xs font-black transition ${
                      trainerEnabled ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Trainerteam {trainerEnabled ? "aktiv" : "aus"}
                  </button>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Zusatzrollen</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {assignableRoles.length === 0 ? (
                      <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500">Keine Rollen verfügbar</span>
                    ) : (
                      assignableRoles.map((role) => {
                        const isActive = activeRolePermissions.some((permission) => permission.roleId === role.id);
                        return (
                          <button
                            key={role.id}
                            type="button"
                            disabled={isPending || seasonLocked}
                    onClick={() => toggleRolePermission(teamSeason.id, role, !isActive)}
                            className={`rounded-full border px-3 py-2 text-xs font-black transition ${
                              isActive
                                ? "border-blue-200 bg-blue-50 text-[#0b4aa2] hover:bg-blue-100"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {role.name}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {seasonLocked ? <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-3 py-3 text-xs font-bold leading-5 text-red-700">Diese Saison ist abgeschlossen. Bestehende Freigaben bleiben dokumentiert, neue Bewertungen sind gesperrt.</div> : null}

                <div className="mt-4 rounded-2xl bg-slate-50 px-3 py-3">
                  <div className="flex items-center gap-2">
                    <UsersRound className="h-4 w-4 text-slate-400" />
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Aktuelle Bewerter</p>
                  </div>

                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-semibold leading-5 text-slate-600">
                      <span className="font-black text-slate-800">Trainerteam:</span>{" "}
                      {trainerEnabled
                        ? preview?.trainerNames.length
                          ? preview.trainerNames.join(", ")
                          : "Aktiv, aber keine aktiven Trainer zugeordnet"
                        : "Nicht aktiv"}
                    </p>

                    {preview?.roleRaters.length ? (
                      preview.roleRaters.map((roleRater) => (
                        <p key={roleRater.roleId} className="text-xs font-semibold leading-5 text-slate-600">
                          <span className="font-black text-slate-800">{roleRater.roleName}:</span>{" "}
                          {roleRater.names.length ? roleRater.names.join(", ") : "Keine aktiven Benutzer"}
                        </p>
                      ))
                    ) : (
                      <p className="text-xs font-semibold leading-5 text-slate-500">Keine Zusatzrolle aktiv.</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-2">
        <AdminFormCard title="Freigaben Übersicht" icon={<ShieldCheck className="h-5 w-5" />}>
          <div className="space-y-3">
            {permissions.length === 0 ? (
              <AdminActionListCard emptyText="Nur Admins dürfen bewerten. Keine zusätzlichen Freigaben erfasst." />
            ) : (
              <AdminActionListCard emptyText="">
                {permissions.map((permission) => {
                  const teamSeason = teamSeasons.find((entry) => entry.id === permission.teamSeasonId);
                  return (
                    <div key={permission.id} className="flex min-w-0 flex-col gap-3 rounded-xl bg-slate-50 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">{permissionTitle(permission)}</p>
                        <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                          {teamSeason?.teamName ?? permission.teamSeason?.team.name ?? "Team"} · {teamSeason?.seasonName ?? permission.teamSeason?.season.name ?? "Saison"} · {permission.isActive ? "Aktiv" : "Inaktiv"}
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
                  );
                })}
              </AdminActionListCard>
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
            Änderungen werden automatisch in den Spielerprofilen sichtbar.
          </span>
        </AdminInlineStatusMessage>
      </div>
    </div>
  );
}



