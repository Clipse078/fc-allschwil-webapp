import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, BadgeCheck, BriefcaseBusiness, CalendarDays, Mail, Phone, ShieldCheck, UserRound, Users } from "lucide-react";

import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type Props = {
  params: Promise<{ personId: string }>;
};

function formatDate(value: Date | null | undefined) {
  if (!value) return "Offen";
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function getName(input: { displayName: string | null; firstName: string; lastName: string }) {
  return input.displayName ?? `${input.firstName} ${input.lastName}`.trim();
}

function InfoTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#0b4aa2]">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-1 truncate text-sm font-bold text-slate-800">{value}</p>
        </div>
      </div>
    </div>
  );
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
      user: {
        select: {
          isActive: true,
          accessState: true,
          userRoles: {
            select: {
              role: {
                select: {
                  name: true,
                  key: true,
                  organigrammDisplayName: true,
                  organigrammDepartment: { select: { name: true } },
                },
              },
            },
          },
        },
      },
      playerSquadMembers: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        select: {
          shirtNumber: true,
          positionLabel: true,
          isCaptain: true,
          isViceCaptain: true,
          teamSeason: {
            select: {
              shortName: true,
              displayName: true,
              season: { select: { name: true, isActive: true } },
              team: { select: { name: true } },
            },
          },
        },
      },
      trainerTeamMembers: {
        where: { status: "ACTIVE" },
        orderBy: { sortOrder: "asc" },
        select: {
          roleLabel: true,
          isWebsiteVisible: true,
          teamSeason: {
            select: {
              shortName: true,
              displayName: true,
              season: { select: { name: true, isActive: true } },
              team: { select: { name: true } },
            },
          },
        },
      },
      trainerQualifications: {
        orderBy: { createdAt: "desc" },
        select: {
          title: true,
          type: true,
          status: true,
          issuer: true,
          issuedAt: true,
          expiresAt: true,
          isClubVerified: true,
          isWebsiteVisible: true,
          createdAt: true,
        },
      },
      vereinsleitungOwnedMatters: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          title: true,
          status: true,
          priority: true,
          dueDate: true,
        },
      },
      meetingParticipants: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          displayName: true,
          roleLabel: true,
          status: true,
          meeting: {
            select: {
              title: true,
              startAt: true,
            },
          },
        },
      },
    },
  });

  if (!person) notFound();

  const name = getName(person);
  const roleNames = person.user?.userRoles.map((entry) => entry.role.organigrammDisplayName ?? entry.role.name) ?? [];
  const departments = Array.from(new Set(person.user?.userRoles.map((entry) => entry.role.organigrammDepartment?.name).filter(Boolean) ?? []));
  const primaryType = person.isTrainer ? "Trainer" : person.isPlayer ? "Spieler" : roleNames.length ? "Vereinsfunktionär" : "Person";
  const typeLabels = [
    person.isPlayer ? "Spieler" : null,
    person.isTrainer ? "Trainer" : null,
    roleNames.length ? "Vereinsfunktionär" : null,
    !person.isPlayer && !person.isTrainer && roleNames.length === 0 ? "Person" : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
        <div className="h-1.5 bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />
        <div className="p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-5">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[28px] bg-gradient-to-br from-blue-50 to-red-50 text-2xl font-black text-[#0b4aa2]">
                {person.firstName.charAt(0)}
                {person.lastName.charAt(0)}
              </div>

              <div>
                <p className="fca-eyebrow">Personenprofil · {primaryType}</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{name}</h1>
                <div className="mt-3 flex flex-wrap gap-2">
                  {typeLabels.map((label) => (
                    <span key={label} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-black text-[#0b4aa2]">
                      {label}
                    </span>
                  ))}
                  <span className={"rounded-full border px-3 py-1.5 text-xs font-black " + (person.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500")}>
                    {person.isActive ? "Aktiv" : "Inaktiv"}
                  </span>
                </div>
              </div>
            </div>

            <Link href="/dashboard/persons" className="w-fit rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50">
              Zurück zu Personen
            </Link>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <InfoTile label="E-Mail" value={person.email ?? "Offen"} icon={<Mail className="h-4 w-4" />} />
            <InfoTile label="Telefon" value={person.phone ?? "Offen"} icon={<Phone className="h-4 w-4" />} />
            <InfoTile label="Geburtsdatum" value={formatDate(person.dateOfBirth)} icon={<CalendarDays className="h-4 w-4" />} />
            <InfoTile label="Im Verein seit" value={formatDate(person.clubJoinDate)} icon={<ShieldCheck className="h-4 w-4" />} />
          </div>
        </div>
      </section>

      {person.isTrainer ? (
        <section className="rounded-[32px] border border-blue-100 bg-gradient-to-br from-white via-blue-50/50 to-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="fca-eyebrow">Trainerprofil</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Trainer & Qualifikationen</h2>
            </div>
            <span className="rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-black text-[#0b4aa2]">
              {person.trainerExperienceYears ?? 0} Jahre Erfahrung
            </span>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-[#0b4aa2]" />
                <h3 className="font-black text-slate-900">Teamzuordnungen</h3>
              </div>
              <div className="mt-4 space-y-3">
                {person.trainerTeamMembers.length === 0 ? (
                  <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">Noch keinem Team zugeordnet.</p>
                ) : (
                  person.trainerTeamMembers.map((assignment) => {
                    const teamName = assignment.teamSeason.shortName ?? assignment.teamSeason.displayName ?? assignment.teamSeason.team.name;
                    return (
                      <div key={`${teamName}-${assignment.roleLabel}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <p className="font-black text-slate-900">{teamName}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {assignment.roleLabel ?? "Trainer"} · {assignment.teamSeason.season.name}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <Award className="h-5 w-5 text-[#0b4aa2]" />
                <h3 className="font-black text-slate-900">Qualifikationen</h3>
              </div>
              <div className="mt-4 space-y-3">
                {person.trainerQualifications.length === 0 ? (
                  <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">Noch keine Qualifikationen hinterlegt.</p>
                ) : (
                  person.trainerQualifications.map((qualification) => (
                    <div key={`${qualification.title}-${qualification.createdAt.toISOString()}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-slate-900">{qualification.title}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {qualification.type} · {qualification.status} · {qualification.issuer ?? "Aussteller offen"}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-400">
                            Ausgestellt: {formatDate(qualification.issuedAt)} · Gültig bis: {formatDate(qualification.expiresAt)}
                          </p>
                        </div>
                        {qualification.isClubVerified ? (
                          <BadgeCheck className="h-5 w-5 shrink-0 text-emerald-600" />
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {roleNames.length > 0 ? (
        <section className="rounded-[32px] border border-violet-100 bg-gradient-to-br from-white via-violet-50/50 to-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="fca-eyebrow">Vereinsfunktionär</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Funktionen & Verantwortung</h2>
            </div>
            <span className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-black text-violet-700">
              {roleNames.length} Rolle{roleNames.length === 1 ? "" : "n"}
            </span>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <BriefcaseBusiness className="h-5 w-5 text-violet-700" />
                <h3 className="font-black text-slate-900">Rollen</h3>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {roleNames.map((role) => (
                  <span key={role} className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-black text-violet-700">
                    {role}
                  </span>
                ))}
              </div>
              {departments.length ? (
                <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Bereiche</p>
                  <p className="mt-1 text-sm font-bold text-slate-700">{departments.join(", ")}</p>
                </div>
              ) : null}
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                <h3 className="font-black text-slate-900">Offene Pendenzen</h3>
                <div className="mt-4 space-y-3">
                  {person.vereinsleitungOwnedMatters.length === 0 ? (
                    <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">Keine offenen Einträge sichtbar.</p>
                  ) : (
                    person.vereinsleitungOwnedMatters.map((matter) => (
                      <div key={matter.title} className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="font-bold text-slate-900">{matter.title}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {matter.status} · {matter.priority} · {formatDate(matter.dueDate)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                <h3 className="font-black text-slate-900">Meeting-Bezug</h3>
                <div className="mt-4 space-y-3">
                  {person.meetingParticipants.length === 0 ? (
                    <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">Keine Meeting-Teilnahmen sichtbar.</p>
                  ) : (
                    person.meetingParticipants.map((participant) => (
                      <div key={`${participant.meeting.title}-${participant.meeting.startAt.toISOString()}`} className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="font-bold text-slate-900">{participant.meeting.title}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {formatDate(participant.meeting.startAt)} · {participant.status} · {participant.roleLabel ?? participant.displayName}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {person.isPlayer ? (
        <section className="rounded-[32px] border border-emerald-100 bg-white p-6 shadow-sm">
          <p className="fca-eyebrow">Spielerprofil</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">Aktuelle Kaderzuordnung</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {person.playerSquadMembers.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">Noch keinem Team zugeordnet.</p>
            ) : (
              person.playerSquadMembers.map((assignment) => {
                const teamName = assignment.teamSeason.shortName ?? assignment.teamSeason.displayName ?? assignment.teamSeason.team.name;
                return (
                  <div key={teamName} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <p className="font-black text-slate-900">{teamName}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {assignment.positionLabel ?? "Position offen"} · {assignment.teamSeason.season.name}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
