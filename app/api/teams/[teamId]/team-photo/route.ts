import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import fs from "fs";
import path from "path";

export async function POST(req: Request, { params }: any) {
  const { teamId } = params;
  const formData = await req.formData();

  const file = formData.get("file") as File | null;
  const teamSeasonId = formData.get("teamSeasonId") as string | null;
  const x = Number(formData.get("x") || 50);
  const y = Number(formData.get("y") || 50);
  const zoom = Number(formData.get("zoom") || 100);
  const rotate = Number(formData.get("rotate") || 0);
  const visible = formData.get("visible") === "true";

  if (!teamSeasonId) {
    return NextResponse.json({ error: "Missing teamSeasonId" }, { status: 400 });
  }

  let url: string | undefined;

  if (file) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const extension = file.name.split(".").pop() || "jpg";
    const fileName = `team-${teamId}-${Date.now()}.${extension}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "team-photos");

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    fs.writeFileSync(path.join(uploadDir, fileName), buffer);
    url = `/uploads/team-photos/${fileName}`;
  }

  await prisma.teamSeason.update({
    where: { id: teamSeasonId },
    data: {
      ...(url ? { teamPhotoUrl: url } : {}),
      teamPhotoX: x,
      teamPhotoY: y,
      teamPhotoZoom: zoom,
      teamPhotoRotate: rotate,
      teamPhotoVisible: visible,
    },
  });

  return NextResponse.json({ ok: true, url });
}