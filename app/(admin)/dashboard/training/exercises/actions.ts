"use server";

import {
  ExerciseDifficulty,
  ExerciseSport,
  TrainingFocus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getExerciseTemplateById } from "@/lib/training/exercise-catalog";

async function requireExerciseAccess() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const keys = session.user.permissionKeys ?? [];
  const allowed =
    keys.includes(PERMISSIONS.EVENTS_MANAGE) ||
    keys.includes(PERMISSIONS.SEASONS_VIEW) ||
    keys.includes(PERMISSIONS.SEASONS_MANAGE);

  if (!allowed) {
    redirect("/dashboard/training/exercises?status=forbidden");
  }

  return session;
}

export async function importExerciseTemplate(formData: FormData) {
  await requireExerciseAccess();

  const templateId = String(formData.get("templateId") ?? "").trim();
  const seasonId = String(formData.get("seasonId") ?? "").trim() || null;
  const teamId = String(formData.get("teamId") ?? "").trim() || null;

  if (!templateId) return;

  const tpl = getExerciseTemplateById(templateId);
  if (!tpl) return;

  await prisma.clubExercise.create({
    data: {
      templateId: tpl.id,
      sport: tpl.sport as ExerciseSport,
      focus: tpl.focus as TrainingFocus,
      difficulty: tpl.difficulty as ExerciseDifficulty,
      title: tpl.title,
      description: tpl.description,
      setup: tpl.setup,
      coachingPoints: tpl.coachingPoints,
      variations: tpl.variations,
      equipment: tpl.equipment,
      durationMinutes: tpl.durationMinutes,
      audienceTags: tpl.audienceTags,
      seasonId,
      teamId,
    },
  });

  revalidatePath("/dashboard/training/exercises");
}

export async function deleteClubExercise(formData: FormData) {
  await requireExerciseAccess();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  await prisma.clubExercise.delete({ where: { id } });

  revalidatePath("/dashboard/training/exercises");
}

export async function updateClubExercise(formData: FormData) {
  await requireExerciseAccess();

  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();

  if (!id || !title) return;

  const toNullable = (key: string) => {
    const v = String(formData.get(key) ?? "").trim();
    return v || null;
  };
  const toInt = (key: string) => {
    const v = parseInt(String(formData.get(key) ?? ""), 10);
    return isNaN(v) ? null : v;
  };

  await prisma.clubExercise.update({
    where: { id },
    data: {
      title,
      description: toNullable("description") ?? "",
      setup: toNullable("setup"),
      coachingPoints: toNullable("coachingPoints"),
      variations: toNullable("variations"),
      equipment: toNullable("equipment"),
      durationMinutes: toInt("durationMinutes"),
    },
  });

  revalidatePath("/dashboard/training/exercises");
}
