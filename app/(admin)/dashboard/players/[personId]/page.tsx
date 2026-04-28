import Link from "next/link";
import { auth } from "@/auth";
import { notFound } from "next/navigation";
import { CalendarDays, Footprints, Mail, MapPin, Phone, ShieldAlert, Shirt, UserRound } from "lucide-react";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import PlayerSeasonRatingsCard from "@/components/admin/players/PlayerSeasonRatingsCard";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getCurrentSeasonOptionData, getSeasonOptionsData } from "@/lib/seasons/queries";
import { getPlayerRatingPermissionReasons, getRatingPermissionSummaryForPlayer } from "@/lib/players/player-rating-permissions";

type Props = {
  params: Promise<{ personId: string }>;
};

function formatDate(value: Date | null) {
  if (!value) return "Nicht hinterlegt";
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function getAge(value: Date | null) {
  if (!value) return null;
  const now = new Date();
  let age = now.getFullYear() - value.getFullYear();
  const monthDiff = now.getMonth() - value.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < value.getDate())) {
    age -= 1;
  }

  return age;
}

export default async function PlayerProfilePage({ params }: Props) {
  await requirePermission(PERMISSIONS.PEOPLE_VIEW);
  const session = await auth();

  const { personId } = await params;

  const [person, seasons, currentSeason] = await Promise.all([
    prisma.person.findUnique({
      where: { id: personId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        email: true,
        phone: true,
        dateOfBirth: true,
        notes: true,
        isActive: true,
        isPlayer: true,
        playerSquadMembers: {
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            positionLabel: true,
            shirtNumber: true,
            teamSeason: {
              select: {
                displayName: true,
                shortName: true,
                team: {
                  select: {
                    name: true,
                    category: true,
                    ageGroup: true,
                  },
                },
              },
            },
          },
        },
        playerRatingPermissions: {
          where: { isActive: true },
          include: {
            teamSeason: { select: { id: true, displayName: true, shortName: true, team: { select: { name: true } }, season: { select: { name: true, key: true, isActive: true } } } },
            person: { select: { id: true, firstName: true, lastName: true, displayName: true, email: true } },
            role: { select: { id: true, key: true, name: true } },
          },
        },
        playerSeasonRatings: {
          orderBy: { season: { startDate: "desc" } },
          include: {
            season: {
              select: {
                id: true,
                key: true,
                name: true,
                isActive: true,
              },
            },
          },
        },
      },
    }),
    getSeasonOptionsData(),
    getCurrentSeasonOptionData(),
  ]);

  if (!person || !person.isPlayer) {
    notFound();
  }

  const displayName = person.displayName ?? `${person.firstName} ${person.lastName}`.trim();
  const initials = `${person.firstName?.[0] ?? ""}${person.lastName?.[0] ?? ""}`.toUpperCase() || "SP";
  const birthYear = person.dateOfBirth ? String(person.dateOfBirth.getFullYear()) : null;
  const age = getAge(person.dateOfBirth);
  const activeSquad = person.playerSquadMembers[0] ?? null;
  const activeTeam = activeSquad?.teamSeason ?? null;
  const teamLabel = activeTeam?.shortName ?? activeTeam?.displayName ?? activeTeam?.team.name ?? "Kein Team";
  const positionLabel = activeSquad?.positionLabel ?? "Position offen";
  const shirtNumber = activeSquad?.shirtNumber ? `#${activeSquad.shirtNumber}` : "Nicht hinterlegt";

  const seasonOptions = seasons.map((season) => ({
    id: season.id,
    key: season.key,
    name: season.name,
    isActive: season.isActive,
  }));

  const actorUserId = session?.user?.effectiveUserId ?? session?.user?.id ?? null;
  const ratingPermissionReasons = currentSeason?.id
    ? await getPlayerRatingPermissionReasons({
        userId: actorUserId,
        personId: person.id,
        seasonId: currentSeason.id,
      })
    : { canRate: false, reasons: ["Keine aktive Saison"] };
  const canEditCurrentSeasonRating = ratingPermissionReasons.canRate;

  const ratingPermissionSummary = await getRatingPermissionSummaryForPlayer({
    personId: person.id,
    seasonId: currentSeason?.id ?? null,
  });

  const ratings = person.playerSeasonRatings.map((rating) => ({
    id: rating.id,
    personId: rating.personId,
    seasonId: rating.seasonId,
    overallRating: rating.overallRating,
    potentialRating: rating.potentialRating,
    technicalRating: rating.technicalRating,
    tacticalRating: rating.tacticalRating,
    physicalRating: rating.physicalRating,
    mentalityRating: rating.mentalityRating,
    socialRating: rating.socialRating,
    notes: rating.notes,
    season: {
      id: rating.season.id,
      key: rating.season.key,
      name: rating.season.name,
      isActive: rating.season.isActive,
    },
  }));

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Spielerprofil"
        title={displayName}
        description="Profil, Teamzuordnung, Kontaktdaten und Saisonbewertungen in einer schnellen Übersicht."
      />

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <AdminSurfaceCard className="overflow-hidden p-0">
            <div className="h-1.5 w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />
            <div className="p-6 text-center">
              <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-blue-50 via-white to-red-50 shadow-inner">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-2xl font-bold text-[#0b4aa2] shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                  {initials}
                </div>
              </div>

              <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
                {displayName}
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {teamLabel}
              </p>

              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <span className="fca-pill">{positionLabel}</span>
                {age !== null ? <span className="fca-pill">{age} Jahre</span> : null}
                <span className="fca-pill">{person.isActive ? "Aktiv" : "Inaktiv"}</span>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-100 pt-5 text-left">
                <ProfileMiniItem icon={CalendarDays} label="Geboren" value={formatDate(person.dateOfBirth)} />
                <ProfileMiniItem icon={UserRound} label="Jahrgang" value={birthYear ?? "Offen"} />
                <ProfileMiniItem icon={Shirt} label="Rückennummer" value={shirtNumber} />
                <ProfileMiniItem icon={Footprints} label="Fuss" value="Offen" />
              </div>
            </div>
          </AdminSurfaceCard>

          <AdminSurfaceCard className="p-6">
            <h3 className="text-lg font-semibold tracking-tight text-slate-950">
              Kontakt
            </h3>
            <div className="mt-5 space-y-4">
              <ContactItem icon={Mail} label="E-Mail" value={person.email ?? "Keine E-Mail hinterlegt"} />
              <ContactItem icon={Phone} label="Telefon" value={person.phone ?? "Keine Telefonnummer hinterlegt"} />
              <ContactItem icon={MapPin} label="Adresse" value="Noch nicht hinterlegt" />
            </div>

            <div className="mt-6 border-t border-slate-100 pt-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ShieldAlert className="h-4 w-4 text-red-500" />
                Notfallkontakt
              </div>
              <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Noch nicht hinterlegt
              </div>
            </div>
          </AdminSurfaceCard>
        </div>

        <div className="space-y-6">
          <AdminSurfaceCard className="overflow-hidden p-0">
            <div className="h-1.5 w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />
            <div className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Team Assignment
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {teamLabel}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {activeTeam?.team.category ?? "Kategorie offen"} · {activeTeam?.team.ageGroup ?? "Altersgruppe offen"}
                  </p>
                </div>
                <span className="w-fit rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                  Aktuelle Zuordnung
                </span>
              </div>
            </div>
          </AdminSurfaceCard>

          <AdminSurfaceCard className="p-6">
            <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-4">
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                Coach Notes
              </span>
              <span className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500">
                Activity Log später
              </span>
            </div>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Medical & General Info
              </p>
              <div className="mt-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {person.notes ?? "Keine medizinischen oder allgemeinen Hinweise hinterlegt."}
              </div>
            </div>
          </AdminSurfaceCard>

          <AdminSurfaceCard className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Bewertungsrechte
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                  Wer darf bewerten?
                </h2>
              </div>
              <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                Read-only
              </span>
            </div>

            {person.playerRatingPermissions.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">
                Für dieses Spielerprofil sind noch keine expliziten Bewertungsrechte sichtbar.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {person.playerRatingPermissions.map((permission) => {
                  const assignee =
                    permission.person?.displayName ??
                    (permission.person ? `${permission.person.firstName} ${permission.person.lastName}`.trim() : null) ??
                    permission.role?.name ??
                    "Unbekannt";

                  return (
                    <div key={permission.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">{assignee}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {permission.teamSeason.team.name} · {permission.teamSeason.season.name} · {permission.label ?? "Bewertung"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </AdminSurfaceCard>
          <AdminSurfaceCard className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="fca-eyebrow">Bewertungsrechte</p>
            <h2 className="mt-2 text-xl font-black text-slate-900">Wer darf bewerten?</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              Diese Ansicht ist aus der Admin-Konfiguration pro Team-Saison abgeleitet.
            </p>
          </div>
          <span className={"w-fit rounded-full border px-3 py-1.5 text-xs font-black " + (canEditCurrentSeasonRating ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500")}>
            {canEditCurrentSeasonRating ? "Du darfst bewerten" : "Nur Leserechte"}
          </span>

          <div className="space-y-1">
            {ratingPermissionReasons.reasons.map((reason) => (
              <p key={reason} className="text-xs font-semibold text-slate-500">
                • {reason}
              </p>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {ratingPermissionSummary.labels.map((label) => (
            <span key={label} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">
              {label}
            </span>
          ))}
        </div>
      </AdminSurfaceCard>
      <PlayerSeasonRatingsCard
            personId={person.id}
            seasons={seasonOptions}
            currentSeasonId={currentSeason?.id ?? null}
            initialRatings={ratings}
          canEdit={canEditCurrentSeasonRating} />
        </div>
      </div>

      <Link
        href="/dashboard/players"
        className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
      >
        Zurück zur Spielerliste
      </Link>
    </div>
  );
}

function ProfileMiniItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function ContactItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 text-slate-400" />
      <div>
        <p className="text-sm font-medium text-slate-800">{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
      </div>
    </div>
  );
}









