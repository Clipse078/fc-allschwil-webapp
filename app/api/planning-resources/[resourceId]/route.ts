import { NextResponse } from "next/server";
import { PlanningResourceType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type RouteContext = {
  params: Promise<{
    resourceId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { resourceId } = await context.params;
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Keine Daten erhalten." }, { status: 400 });
  }

  const data: {
    name?: string;
    type?: PlanningResourceType;
    sortOrder?: number;
    isActive?: boolean;
    notes?: string | null;
  } = {};

  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }

  if (Object.values(PlanningResourceType).includes(body.type)) {
    data.type = body.type;
  }

  if (Number.isFinite(Number(body.sortOrder))) {
    data.sortOrder = Number(body.sortOrder);
  }

  if (typeof body.isActive === "boolean") {
    data.isActive = body.isActive;
  }

  if (typeof body.notes === "string") {
    data.notes = body.notes.trim() || null;
  }

  const resource = await prisma.planningResource.update({
    where: { id: resourceId },
    data,
  });

  return NextResponse.json({ resource });
}
