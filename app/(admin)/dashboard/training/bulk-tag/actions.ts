"use server";

import { TrainingFocus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";

async function requireAccess() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const keys = session.user.permissionKeys ?? [];
  if (!keys.includes(PERMISSIONS.EVENTS_MANAGE)) {
    redirect("/dashboard/training/bulk-tag?status=forbidden");
  }

  return session;
}

export async function tagTrainingFocus(formData: FormData) {
  await requireAccess();

  const eventId = String(formData.get("eventId") ?? "").trim();
  const focusRaw = String(formData.get("trainingFocus") ?? "").trim();

  if (!eventId || !focusRaw) return;

  const allFocuses = Object.values(TrainingFocus) as string[];
  if (!allFocuses.includes(focusRaw)) return;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, type: true },
  });

  if (!event || event.type !== "TRAINING") return;

  await prisma.event.update({
    where: { id: eventId },
    data: { trainingFocus: focusRaw as TrainingFocus },
  });

  revalidatePath("/dashboard/training/bulk-tag");
  revalidatePath("/dashboard/planner");
  revalidatePath("/dashboard/events");
}
