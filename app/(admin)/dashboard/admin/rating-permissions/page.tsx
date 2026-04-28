import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import RatingGovernanceCard from "@/components/admin/ratings/RatingGovernanceCard";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export default async function RatingPermissionsAdminPage() {
  await requirePermission(PERMISSIONS.USERS_MANAGE);

  const [ratingPermissions, ratingAreas, ratingTeamSeasons, ratingRoles, ratingSeasons] =
    await Promise.all([
      prisma.playerRatingPermission.findMany({
        orderBy: [
          { teamSeason: { season: { startDate: "desc" } } },
          { teamSeason: { team: { sortOrder: "asc" } } },
        ],
        include: {
          teamSeason: {
            select: {
              id: true,
              displayName: true,
              shortName: true,
              season: { select: { id: true, key: true, name: true, isActive: true } },
              team: { select: { id: true, name: true, slug: true } },
            },
          },
          season: { select: { id: true, key: true, name: true, isActive: true } },
          role: { select: { id: true, key: true, name: true } },
        },
      }),
      prisma.playerRatingAreaDefinition.findMany({
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
        include: { season: { select: { id: true, key: true, name: true, isActive: true } } },
      }),
      prisma.teamSeason.findMany({
        orderBy: [{ season: { startDate: "desc" } }, { team: { sortOrder: "asc" } }],
        select: {
          id: true,
          displayName: true,
          shortName: true,
          seasonId: true,
          season: { select: { id: true, key: true, name: true, isActive: true } },
          team: { select: { name: true } },
        },
      }),
      prisma.role.findMany({
        orderBy: [{ name: "asc" }],
        select: { id: true, key: true, name: true },
      }),
      prisma.season.findMany({
        orderBy: [{ startDate: "desc" }],
        select: { id: true, key: true, name: true, isActive: true },
      }),
    ]);

  const teamSeasons = ratingTeamSeasons.map((teamSeason) => ({
    id: teamSeason.id,
    displayName: teamSeason.displayName,
    shortName: teamSeason.shortName,
    teamName: teamSeason.team.name,
    seasonId: teamSeason.seasonId,
    seasonName: teamSeason.season.name,
    seasonKey: teamSeason.season.key,
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <AdminSectionHeader
          eyebrow="Admin · Bewertungsrechte"
          title="Spielerbewertungen steuern"
          description="Lege fest, welche Rollen und Trainerteams Spielerbewertungen pro Team-Saison erfassen dürfen. Admins und Superadmins dürfen immer bewerten."
        />

        <Link
          href="/dashboard/admin"
          className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zur Admin-Übersicht
        </Link>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Standard</p>
          <p className="mt-2 text-2xl font-black text-slate-900">Admin</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Admins und Superadmins haben immer Schreibrechte.</p>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Team-Saisons</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{teamSeasons.length}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Bewertungsrechte werden pro Team und Saison vergeben.</p>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Aktive Freigaben</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{ratingPermissions.filter((permission) => permission.isActive).length}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Keine Einzelpersonen. Nur Trainerteam oder Rolle.</p>
        </div>
      </section>

      <RatingGovernanceCard
        seasons={ratingSeasons}
        teamSeasons={teamSeasons}
        roles={ratingRoles}
        permissions={ratingPermissions}
        areas={ratingAreas}
      />

      <div className="rounded-[28px] border border-blue-100 bg-blue-50/60 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#0b4aa2]" />
          <div>
            <p className="text-sm font-black text-slate-900">Berechtigungslogik</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
              Ein Spieler kann bewertet werden, wenn der aktuelle Benutzer Admin/Superadmin ist, als Trainer dieser Team-Saison freigegeben ist oder eine explizit freigegebene Rolle besitzt.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
