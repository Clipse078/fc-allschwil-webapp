"use server";

import { EventSource, EventStatus, EventType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  assertEventBelongsToTenant,
  assertTeamBelongsToTenant,
} from "@/lib/weekly-plan/tenant-validation";

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
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const permissionKeys = session.user.permissionKeys ?? [];
  const canManage =
    permissionKeys.includes(PERMISSIONS.WOCHENPLAN_MANAGE) ||
    permissionKeys.includes(PERMISSIONS.EVENTS_MANAGE);

  if (!canManage) {
    redirect(buildPlannerRedirect({ status: "forbidden" }));
  }

  return session;
}

// Season has no tenantId field — it is a global/shared entity.
// Season validation is limited to existence and key match.
// Team ownership is enforced via assertTeamBelongsToTenant.
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

  // Season has no tenantId; validate existence and submitted key match only.
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { id: true, key: true },
  });

  if (!season || season.key !== seasonKey) {
    redirect(buildPlannerRedirect({ seasonKey, status: `${prefix}-invalid-season` }));
  }

  // Team must belong to the actor tenant.
  let team: { id: string } | null = null;
  try {
    team = await assertTeamBelongsToTenant(teamId, tenantId);
  } catch {
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

export async function createPlannerEntryAction(formData: FormData) {
  const session = await requirePlannerManagePermission();
  const actorTenantId = session?.user?.tenantId;

  if (!actorTenantId) {
    redirect(buildPlannerRedirect({ status: "create-tenant-required" }));
  }

  const data = await validatePlannerForm(formData, "create", actorTenantId);

  await prisma.event.create({
    data: {
      seasonId: data.season.id,
      teamId: data.teamId,
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
      tenantId: actorTenantId,
    },
  });

  revalidatePlannerPaths();

  redirect(
    buildPlannerRedirect({ seasonKey: data.seasonKey, status: "create-success" }),
  );
}

export async function updatePlannerEntryAction(formData: FormData) {
  const session = await requirePlannerManagePermission();
  const actorTenantId = session?.user?.tenantId;

  if (!actorTenantId) {
    redirect(buildPlannerRedirect({ status: "update-tenant-required" }));
  }

  const eventId = toNullableString(formData.get("eventId"));
  const seasonKey = toNullableString(formData.get("seasonKey"));

  if (!eventId) {
    redirect(buildPlannerRedirect({ seasonKey, status: "update-invalid-event" }));
  }

  try {
    await assertEventBelongsToTenant(eventId, actorTenantId);
  } catch {
    redirect(buildPlannerRedirect({ seasonKey, status: "update-invalid-event" }));
  }

  const data = await validatePlannerForm(formData, "update", actorTenantId);

  const result = await prisma.event.updateMany({
    where: {
      id: eventId,
      tenantId: actorTenantId,
    },
    data: {
      seasonId: data.season.id,
      teamId: data.teamId,
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

  if (result.count === 0) {
    redirect(buildPlannerRedirect({ seasonKey: data.seasonKey, status: "update-invalid-event" }));
  }

  revalidatePlannerPaths();

  redirect(
    buildPlannerRedirect({ seasonKey: data.seasonKey, status: "update-success" }),
  );
}

export async function deletePlannerEntryAction(formData: FormData) {
  const session = await requirePlannerManagePermission();
  const actorTenantId = session?.user?.tenantId;

  if (!actorTenantId) {
    redirect(buildPlannerRedirect({ status: "delete-tenant-required" }));
  }

  const eventId = toNullableString(formData.get("eventId"));
  const seasonKey = toNullableString(formData.get("seasonKey"));

  if (!eventId) {
    redirect(buildPlannerRedirect({ seasonKey, status: "delete-invalid-event" }));
  }

  try {
    await assertEventBelongsToTenant(eventId, actorTenantId);
  } catch {
    redirect(buildPlannerRedirect({ seasonKey, status: "delete-invalid-event" }));
  }

  const result = await prisma.event.deleteMany({
    where: {
      id: eventId,
      tenantId: actorTenantId,
    },
  });

  if (result.count === 0) {
    redirect(buildPlannerRedirect({ seasonKey, status: "delete-invalid-event" }));
  }

  revalidatePlannerPaths();

  redirect(buildPlannerRedirect({ seasonKey, status: "delete-success" }));
}
