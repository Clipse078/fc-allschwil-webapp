import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type CreatePlanningTimeSlotInput = {
  tenantId: string;
  key: string;
  label: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  sortOrder?: number;
  isActive?: boolean;
};

export type UpdatePlanningTimeSlotInput = Partial<
  Omit<CreatePlanningTimeSlotInput, "tenantId">
>;

export function getPlanningTimeSlotsForTenant(tenantId: string) {
  return prisma.planningTimeSlot.findMany({
    where: { tenantId },
    orderBy: [
      { sortOrder: "asc" },
      { startHour: "asc" },
      { startMinute: "asc" },
      { createdAt: "asc" },
    ],
  });
}

export function getPlanningTimeSlotForTenant(slotId: string, tenantId: string) {
  return prisma.planningTimeSlot.findFirst({
    where: { id: slotId, tenantId },
  });
}

export function createPlanningTimeSlot(input: CreatePlanningTimeSlotInput) {
  return prisma.planningTimeSlot.create({
    data: {
      tenantId: input.tenantId,
      key: input.key,
      label: input.label,
      startHour: input.startHour,
      startMinute: input.startMinute,
      endHour: input.endHour,
      endMinute: input.endMinute,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  });
}

export async function updatePlanningTimeSlot(
  slotId: string,
  tenantId: string,
  data: UpdatePlanningTimeSlotInput,
) {
  const updated = await prisma.planningTimeSlot.updateManyAndReturn({
    where: { id: slotId, tenantId },
    data,
  });

  return updated[0] ?? null;
}

export function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
