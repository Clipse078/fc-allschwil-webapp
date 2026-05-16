"use server";

import { GoalModule } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTemplateById } from "@/lib/strategy/goal-templates";

async function requireStrategyAccess() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const keys = session.user.permissionKeys ?? [];
  const canAccess =
    keys.includes(PERMISSIONS.SEASONS_VIEW) ||
    keys.includes(PERMISSIONS.SEASONS_MANAGE) ||
    keys.includes(PERMISSIONS.EVENTS_MANAGE);

  if (!canAccess) {
    redirect("/dashboard/strategy?status=forbidden");
  }

  return session;
}

export async function importGoalTemplate(formData: FormData) {
  await requireStrategyAccess();

  const templateId = String(formData.get("templateId") ?? "").trim();
  const seasonId = String(formData.get("seasonId") ?? "").trim();
  const teamId = String(formData.get("teamId") ?? "").trim() || null;

  if (!templateId || !seasonId) {
    return;
  }

  const tpl = getTemplateById(templateId);
  if (!tpl) return;

  await prisma.clubGoal.create({
    data: {
      seasonId,
      teamId,
      templateId: tpl.id,
      module: tpl.module as GoalModule,
      title: tpl.title,
      description: tpl.description ?? null,
      metricLabel: tpl.metricLabel ?? null,
      metricValue: tpl.metricValue ?? null,
    },
  });

  revalidatePath("/dashboard/strategy");
}

export async function deleteClubGoal(formData: FormData) {
  await requireStrategyAccess();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  await prisma.clubGoal.delete({ where: { id } });

  revalidatePath("/dashboard/strategy");
}

export async function updateClubGoalTitle(formData: FormData) {
  await requireStrategyAccess();

  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const metricLabel = String(formData.get("metricLabel") ?? "").trim() || null;
  const metricValue = String(formData.get("metricValue") ?? "").trim() || null;

  if (!id || !title) return;

  await prisma.clubGoal.update({
    where: { id },
    data: { title, description, metricLabel, metricValue },
  });

  revalidatePath("/dashboard/strategy");
}

export async function createCustomGoal(formData: FormData) {
  await requireStrategyAccess();

  const seasonId = String(formData.get("seasonId") ?? "").trim();
  const moduleRaw = String(formData.get("module") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const metricLabel = String(formData.get("metricLabel") ?? "").trim() || null;
  const metricValue = String(formData.get("metricValue") ?? "").trim() || null;

  if (!seasonId || !title || !moduleRaw) return;

  const validModules = Object.values(GoalModule) as string[];
  if (!validModules.includes(moduleRaw)) return;

  await prisma.clubGoal.create({
    data: {
      seasonId,
      module: moduleRaw as GoalModule,
      title,
      description,
      metricLabel,
      metricValue,
    },
  });

  revalidatePath("/dashboard/strategy");
}
