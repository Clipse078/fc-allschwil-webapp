import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, BriefcaseBusiness, CalendarDays, Mail, Phone, ShieldCheck, UserCircle2, Users } from "lucide-react";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type Props = {
  params: Promise<{ personId: string }>;
};

function formatDate(value: Date | null) {
  if (!value) return "Nicht hinterlegt";
  return new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value);
}

export default async function PersonDetailPage({ params }: Props) {
  await requirePermission(PERMISSIONS.PEOPLE_VIEW);

  const { personId } = await params;
  const person = await prisma.person.findUnique({
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
      isTrainer: true,
      trainerExperienceYears: true,
      clubJoinDate: true,
      playerSquadMembers: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        select: {
          teamSeason: {
            select: {
              shortName: true,
              displayName: true,
              team: { select: { name: true } },
              season: { select: { name: true } },
            },
          },
        },
      },
      trainerTeamMembers: {
        where: { status: "ACTIVE" },
        orderBy: { sortOrder: "asc" },
        select: {
          roleLabel: true,
          teamSeason: {
            select: {
              shortName: true,
              displayName: true,
              team: { select: { name: true } },
              season: { select: { name: true } },
            },
          },
        },
      },
      trainerQualifications: {
        orderBy: { createdAt: "desc" },
        select: {
          title: true,
          status: true,
          issuer: true,
          createdAt: true,
        },
      },
      user: {
        select: {
          isActive: true,
          userRoles: {
            select: {
              role: { select: { name: true, key: true } },
            },
          },
        },
      },
    },
  });

  if (!person) notFound();

  const name = person.displayName ?? `${person.firstName} ${person.lastName}`.trim();
  const roleNames = person.user?.userRoles.map((entry) => entry.role.name) ?? [];
  const typeLabels = [
    person.isPlayer ? "Spieler" : null,
    person.isTrainer ? "Trainer" : null,
    roleNames.length ? "Vereinsfunktionär" : null,
    !person.isPlayer && !person.isTrainer && roleNames.length === 0 ? "Person" : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Personen"
        title={name}
        description="Zentrales Personenprofil mit rollenbezogenen Ansichten für Trainer, Spieler und Vereinsfunktionäre."
      />

      <AdminSurfaceCard className="overflow-hidden p-0">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />
        <div className="p-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-5">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[28px] bg-gradient-to-br from-blue-50 to-red-50 text-[#0b4aa2] shadow-inner">
                <UserCircle2 className="h-12 w-12" />
              </div>
              <div>
                <div className="flex flex-wrap gap-2">
                  {typeLabels.map((label) => (
                    <span key={label} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-black text-[#0b4aa2]">
                      {label}
                    </span>
                  ))}
                  <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${person.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                    {person.isActive ? "Aktiv" : "Inaktiv"}
                  </span>
                </div>
                <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">{name}</h2>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  {[person.email, person.phone].filter(Boolean).join(" · ") || "Keine Kontaktdaten hinterlegt"}
                </p>
              </div>
            </div>

            <Link href="/dashboard/persons" className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" />
              Zurück
            </Link>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <InfoCard icon={<Mail className="h-4 w-4" />} label="E-Mail" value={person.email ?? "Nicht hinterlegt"} />
            <InfoCard icon={<Phone className="h-4 w-4" />} label="Telefon" value={person.phone ?? "Nicht hinterlegt"} />
            <InfoCard icon={<CalendarDays className="h-4 w-4" />} label="Geburtsdatum" value={formatDate(person.dateOfBirth)} />
            <InfoCard icon={<ShieldCheck className="h-4 w-4" />} label="Im Verein seit" value={formatDate(person.clubJoinDate)} />
          </div>
        </div>
      </AdminSurfaceCard>

      {person.isTrainer ? (
        <AdminSurfaceCard className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="fca-eyebrow">Trainerprofil</p>
              <h2 className="mt-2 text-xl font-black text-slate-900">Trainer & Qualifikationen</h2>
            </div>
            <BadgeCheck className="h-6 w-6 text-[#0b4aa2]" />
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Aktive Teams</p>
              <div className="mt-3 space-y-2">
                {person.trainerTeamMembers.length ? (
                  person.trainerTeamMembers.map((member) => {
                    const team = member.teamSeason.shortName ?? member.teamSeason.displayName ?? member.teamSeason.team.name;
                    return (
                      <div key={`${team}-${member.roleLabel ?? "trainer"}`} className="rounded-2xl bg-white px-4 py-3">
                        <p className="font-black text-slate-900">{team}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{member.roleLabel ?? "Trainer"} · {member.teamSeason.season.name}</p>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm font-semibold text-slate-500">Aktuell keinem Team zugeordnet.</p>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Qualifikationen</p>
              <div className="mt-3 space-y-2">
                {person.trainerQualifications.length ? (
                  person.trainerQualifications.map((qualification) => (
                    <div key={`${qualification.title}-${qualification.status}`} className="rounded-2xl bg-white px-4 py-3">
                      <p className="font-black text-slate-900">{qualification.title}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {qualification.status} · {qualification.issuer ?? "Aussteller offen"} · erfasst am {formatDate(qualification.createdAt)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm font-semibold text-slate-500">Noch keine Qualifikationen hinterlegt.</p>
                )}
              </div>
            </div>
          </div>
        </AdminSurfaceCard>
      ) : null}

      {roleNames.length ? (
        <AdminSurfaceCard className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="fca-eyebrow">Vereinsfunktionär</p>
              <h2 className="mt-2 text-xl font-black text-slate-900">Funktionen & Zugriff</h2>
            </div>
            <BriefcaseBusiness className="h-6 w-6 text-[#0b4aa2]" />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {roleNames.map((role) => (
              <span key={role} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-black text-[#0b4aa2]">
                {role}
              </span>
            ))}
          </div>
        </AdminSurfaceCard>
      ) : null}

      {person.isPlayer ? (
        <AdminSurfaceCard className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="fca-eyebrow">Spielerprofil</p>
              <h2 className="mt-2 text-xl font-black text-slate-900">Aktuelle Teamzuordnung</h2>
            </div>
            <Users className="h-6 w-6 text-[#0b4aa2]" />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {person.playerSquadMembers.length ? (
              person.playerSquadMembers.map((member) => {
                const team = member.teamSeason.shortName ?? member.teamSeason.displayName ?? member.teamSeason.team.name;
                return (
                  <div key={team} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                    <p className="font-black text-slate-900">{team}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{member.teamSeason.season.name}</p>
                  </div>
                );
              })
            ) : (
              <p className="text-sm font-semibold text-slate-500">Aktuell keinem Team zugeordnet.</p>
            )}
          </div>
        </AdminSurfaceCard>
      ) : null}

      {person.notes ? (
        <AdminSurfaceCard className="p-6">
          <p className="fca-eyebrow">Bemerkungen</p>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{person.notes}</p>
        </AdminSurfaceCard>
      ) : null}
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 px-4 py-4">
      <div className="flex items-center gap-2 text-[#0b4aa2]">{icon}<span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</span></div>
      <p className="mt-2 truncate text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}




