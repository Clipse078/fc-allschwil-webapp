"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getNextSwissFootballSeason,
  getSeasonLifecycleStatus,
} from "@/lib/seasons/season-logic";

async function requireSeasonManagePermission() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const permissionKeys = session.user.permissionKeys ?? [];

  if (!permissionKeys.includes(PERMISSIONS.SEASONS_MANAGE)) {
    redirect("/dashboard/seasons?status=forbidden");
  }

  return session;
}

export async function createNextSeasonAction() {
  await requireSeasonManagePermission();

  const nextSeason = getNextSwissFootballSeason(new Date());

  if (!nextSeason) {
    redirect("/dashboard/seasons?status=create-invalid");
  }

  const existingSeason = await prisma.season.findUnique({
    where: {
      key: nextSeason.key,
    },
    select: {
      id: true,
    },
  });

  if (existingSeason) {
    redirect("/dashboard/seasons?status=create-exists");
  }

  await prisma.season.create({
    data: {
      key: nextSeason.key,
      name: `Season ${nextSeason.label}`,
      startDate: nextSeason.startDate,
      endDate: nextSeason.endDate,
      isActive: false,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/seasons");
  revalidatePath("/dashboard/teams");
  revalidatePath("/dashboard/events");

  redirect("/dashboard/seasons?status=create-success");
}

export async function deletePlannedSeasonAction(formData: FormData) {
  await requireSeasonManagePermission();

  const seasonIdValue = formData.get("seasonId");
  const seasonId =
    typeof seasonIdValue === "string" ? seasonIdValue.trim() : "";

  if (!seasonId) {
    redirect("/dashboard/seasons?status=delete-missing-id");
  }

  const season = await prisma.season.findUnique({
    where: {
      id: seasonId,
    },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      _count: {
        select: {
          teamSeasons: true,
          events: true,
          eventImportRuns: true,
        },
      },
    },
  });

  if (!season) {
    redirect("/dashboard/seasons?status=delete-not-found");
  }

  const lifecycleStatus = getSeasonLifecycleStatus({
    startDate: season.startDate,
    endDate: season.endDate,
  });

  if (lifecycleStatus !== "PLANNING") {
    redirect("/dashboard/seasons?status=delete-not-allowed");
  }

  const hasDependencies =
    season._count.teamSeasons > 0 ||
    season._count.events > 0 ||
    season._count.eventImportRuns > 0;

  if (hasDependencies) {
    redirect("/dashboard/seasons?status=delete-has-dependencies");
  }

  await prisma.season.delete({
    where: {
      id: season.id,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/seasons");
  revalidatePath("/dashboard/teams");
  revalidatePath("/dashboard/events");

  redirect("/dashboard/seasons?status=delete-success");
}
