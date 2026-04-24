import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

type RouteContext = {
  params: Promise<{
    sponsorId: string;
  }>;
};

const allowedTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/svg+xml", "svg"],
]);

export async function POST(request: Request, context: RouteContext) {
  const { sponsorId } = await context.params;
  const formData = await request.formData();
  const file = formData.get("logo");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Logo-Datei fehlt." }, { status: 400 });
  }

  const extension = allowedTypes.get(file.type);

  if (!extension) {
    return NextResponse.json(
      { error: "Nur PNG, JPG, WEBP oder SVG Logos sind erlaubt." },
      { status: 400 },
    );
  }

  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Logo ist zu gross. Maximal 2 MB erlaubt." },
      { status: 400 },
    );
  }

  const sponsor = await prisma.businessClubSponsor.findUnique({
    where: { id: sponsorId },
    select: { id: true },
  });

  if (!sponsor) {
    return NextResponse.json({ error: "Sponsor wurde nicht gefunden." }, { status: 404 });
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "business-club", "sponsors");
  await mkdir(uploadDir, { recursive: true });

  const fileName = `${sponsorId}-${Date.now()}.${extension}`;
  const filePath = path.join(uploadDir, fileName);
  const bytes = await file.arrayBuffer();

  await writeFile(filePath, Buffer.from(bytes));

  const logoUrl = `/uploads/business-club/sponsors/${fileName}`;

  const updatedSponsor = await prisma.businessClubSponsor.update({
    where: { id: sponsorId },
    data: { logoUrl },
  });

  return NextResponse.json({ sponsor: updatedSponsor });
}
