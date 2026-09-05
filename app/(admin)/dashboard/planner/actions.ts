"use server";

import { EventSource, EventStatus, EventType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiTenantPermissionContext } from "@/lib/permissions/require-api-tenant-context";
import { TournamentValidationError } from "@/lib/tournaments/errors";
import { resolveTournamentTeamSeasonId } from "@/lib/tournaments/team-season-resolution";

function toBool(value: FormDataEntryValue | null) {
  return value === "on" || value === "true" || value === "1";
}

function toNullableString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function buildPlannerRedirect(args: {
  seasonKey?: string | null;
  status: string;
}) {
  const params = new URLSearchParams();

  if (args.seasonKey) {
    params.set("season", args.seasonKey);
  }

  params.set("status", args.status);

  return `/dashboard/planner?${params.toString()}`;
}

async function requirePlannerManagePermission() {
  const access = await requireApiTenantPermissionContext([
    PERMISSIONS.WOCHENPLAN_MANAGE,
    PERMISSIONS.EVENTS_MANAGE,
  ]);
  if (!access.ok) {
    if (access.status === 401) redirect("/login");
    redirect(buildPlannerRedirect({ status: "forbidden" }));
  }
  return access.context;
}

async function validatePlannerForm(
  formData: FormData,
  mode: "create" | "update",
  tenantId: string,
) {
  const seasonId = toNullableString(formData.get("seasonId"));
  const seasonKey = toNullableString(formData.get("seasonKey"));
  const teamId = toNullableString(formData.get("teamId"));
  const typeRaw = toNullableString(formData.get("type"));
  const sourceRaw = toNullableString(formData.get("source"));
  const title = toNullableString(formData.get("title"));
  const description = toNullableString(formData.get("description"));
  const location = toNullableString(formData.get("location"));
  const opponentName = toNullableString(formData.get("opponentName"));
  const organizerName = toNullableString(formData.get("organizerName"));
  const competitionLabel = toNullableString(formData.get("competitionLabel"));
  const remarks = toNullableString(formData.get("remarks"));
  const startAt = toDate(formData.get("startAt"));
  const endAt = toDate(formData.get("endAt"));

  const prefix = mode === "update" ? "update" : "create";

  if (!seasonId || !seasonKey || !title || !typeRaw || !sourceRaw || !startAt) {
    redirect(buildPlannerRedirect({ seasonKey, status: `${prefix}-missing-fields` }));
  }

  if (!Object.values(EventType).includes(typeRaw as EventType)) {
    redirect(buildPlannerRedirect({ seasonKey, status: `${prefix}-invalid-type` }));
  }

  if (!Object.values(EventSource).includes(sourceRaw as EventSource)) {
    redirect(buildPlannerRedirect({ seasonKey, status: `${prefix}-invalid-source` }));
  }

  if (endAt && endAt.getTime() < startAt.getTime()) {
    redirect(
      buildPlannerRedirect({ seasonKey, status: `${prefix}-invalid-date-range` }),
    );
  }

  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { id: true, key: true },
  });

  if (!season || season.key !== seasonKey) {
    redirect(buildPlannerRedirect({ seasonKey, status: `${prefix}-invalid-season` }));
  }

  const team = teamId
    ? await prisma.team.findFirst({
        where: { id: teamId, tenantId },
        select: { id: true },
      })
    : null;

  if (teamId && !team) {
    redirect(buildPlannerRedirect({ seasonKey, status: `${prefix}-invalid-team` }));
  }

  return {
    season,
    seasonKey,
    teamId: team?.id ?? null,
    type: typeRaw as EventType,
    source: sourceRaw as EventSource,
    title,
    description,
    location,
    opponentName,
    organizerName,
    competitionLabel,
    remarks,
    startAt,
    endAt,
    websiteVisible: toBool(formData.get("websiteVisible")),
    infoboardVisible: toBool(formData.get("infoboardVisible")),
    homepageVisible: toBool(formData.get("homepageVisible")),
    wochenplanVisible: toBool(formData.get("wochenplanVisible")),
    trainingsplanVisible: toBool(formData.get("trainingsplanVisible")),
    teamPageVisible: toBool(formData.get("teamPageVisible")),
    pitchCode: toNullableString(formData.get("pitchCode")),
    homeDressingRoomCode: toNullableString(formData.get("homeDressingRoomCode")),
    awayDressingRoomCode: toNullableString(formData.get("awayDressingRoomCode")),
  };
}

function revalidatePlannerPaths() {
  revalidatePath("/dashboard/planner");
  revalidatePath("/dashboard/planner/week");
  revalidatePath("/dashboard/planner/day");
  revalidatePath("/dashboard/wochenplan");
  revalidatePath("/dashboard/events");
}

async function resolvePlannerTournamentTeamSeasonId(args: {
  tenantId: string | null;
  teamId: string | null;
  seasonId: string;
  seasonKey: string;
  type: EventType;
  mode: "create" | "update";
}) {
  if (args.type !== EventType.TOURNAMENT || !args.teamId) {
    return null;
  }

  if (!args.tenantId) {
    redirect(
      buildPlannerRedirect({
        seasonKey: args.seasonKey,
        status: `${args.mode}-tenant-required`,
      }),
    );
  }

  try {
    return await resolveTournamentTeamSeasonId(
      args.tenantId,
      args.teamId,
      args.seasonId,
    );
  } catch (error) {
    if (error instanceof TournamentValidationError) {
      redirect(
        buildPlannerRedirect({
          seasonKey: args.seasonKey,
          status: `${args.mode}-invalid-team-season`,
        }),
      );
    }
    throw error;
  }
}

export async function createPlannerEntryAction(formData: FormData) {
  const context = await requirePlannerManagePermission();
  const tenantId = context.tenantId;
  if (!tenantId) {
    redirect(buildPlannerRedirect({ status: "create-tenant-required" }));
  }
  const data = await validatePlannerForm(formData, "create", tenantId);
  const teamSeasonId = await resolvePlannerTournamentTeamSeasonId({
    tenantId,
    teamId: data.teamId,
    seasonId: data.season.id,
    seasonKey: data.seasonKey,
    type: data.type,
    mode: "create",
  });

  await prisma.event.create({
    data: {
      seasonId: data.season.id,
      teamId: data.teamId,
      teamSeasonId,
      type: data.type,
      source: data.source,
      status: EventStatus.SCHEDULED,
      title: data.title,
      description: data.description,
      location: data.location,
      startAt: data.startAt,
      endAt: data.endAt,
      opponentName: data.opponentName,
      organizerName: data.organizerName,
      competitionLabel: data.competitionLabel,
      remarks: data.remarks,
      websiteVisible: data.websiteVisible,
      infoboardVisible: data.infoboardVisible,
      homepageVisible: data.homepageVisible,
      wochenplanVisible: data.wochenplanVisible,
      trainingsplanVisible: data.trainingsplanVisible,
      teamPageVisible: data.teamPageVisible,
      pitchCode: data.pitchCode,
      homeDressingRoomCode: data.homeDressingRoomCode,
      awayDressingRoomCode: data.awayDressingRoomCode,
      tenantId,
    },
  });

  revalidatePlannerPaths();

  redirect(
    buildPlannerRedirect({ seasonKey: data.seasonKey, status: "create-success" }),
  );
}

export async function updatePlannerEntryAction(formData: FormData) {
  const context = await requirePlannerManagePermission();
  const tenantId = context.tenantId;
  if (!tenantId) {
    redirect(buildPlannerRedirect({ status: "update-tenant-required" }));
  }

  const eventId = toNullableString(formData.get("eventId"));
  const seasonKey = toNullableString(formData.get("seasonKey"));

  if (!eventId) {
    redirect(buildPlannerRedirect({ seasonKey, status: "update-invalid-event" }));
  }

  const existingEvent = await prisma.event.findFirst({
    where: { id: eventId, tenantId },
    select: { id: true },
  });

  if (!existingEvent) {
    redirect(buildPlannerRedirect({ seasonKey, status: "update-invalid-event" }));
  }

  const data = await validatePlannerForm(formData, "update", tenantId);
  const teamSeasonId = await resolvePlannerTournamentTeamSeasonId({
    tenantId,
    teamId: data.teamId,
    seasonId: data.season.id,
    seasonKey: data.seasonKey,
    type: data.type,
    mode: "update",
  });

  await prisma.event.update({
    where: { id: eventId, tenantId },
    data: {
      seasonId: data.season.id,
      teamId: data.teamId,
      teamSeasonId,
      type: data.type,
      source: data.source,
      title: data.title,
      description: data.description,
      location: data.location,
      startAt: data.startAt,
      endAt: data.endAt,
      opponentName: data.opponentName,
      organizerName: data.organizerName,
      competitionLabel: data.competitionLabel,
      remarks: data.remarks,
      websiteVisible: data.websiteVisible,
      infoboardVisible: data.infoboardVisible,
      homepageVisible: data.homepageVisible,
      wochenplanVisible: data.wochenplanVisible,
      trainingsplanVisible: data.trainingsplanVisible,
      teamPageVisible: data.teamPageVisible,
      pitchCode: data.pitchCode,
      homeDressingRoomCode: data.homeDressingRoomCode,
      awayDressingRoomCode: data.awayDressingRoomCode,
    },
  });

  revalidatePlannerPaths();

  redirect(
    buildPlannerRedirect({ seasonKey: data.seasonKey, status: "update-success" }),
  );
}

export async function deletePlannerEntryAction(formData: FormData) {
  const context = await requirePlannerManagePermission();
  const tenantId = context.tenantId;

  const eventId = toNullableString(formData.get("eventId"));
  const seasonKey = toNullableString(formData.get("seasonKey"));

  if (!eventId || !tenantId) {
    redirect(buildPlannerRedirect({ seasonKey, status: "delete-invalid-event" }));
  }

  const existingEvent = await prisma.event.findFirst({
    where: { id: eventId, tenantId },
    select: { id: true },
  });

  if (!existingEvent) {
    redirect(buildPlannerRedirect({ seasonKey, status: "delete-invalid-event" }));
  }

  await prisma.event.delete({
    where: { id: eventId, tenantId },
  });

  revalidatePlannerPaths();

  redirect(buildPlannerRedirect({ seasonKey, status: "delete-success" }));
}
