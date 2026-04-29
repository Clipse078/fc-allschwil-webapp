import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { logAction } from "@/lib/audit/log-action";

type Context = {
  params: Promise<{ personId: string }>;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: NextRequest, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.PEOPLE_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { personId } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Bitte ein Bild auswählen." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Nur JPG, PNG oder WebP sind erlaubt." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Das Bild darf maximal 5 MB gross sein." }, { status: 400 });
    }

    const person = await prisma.person.findUnique({
      where: { id: personId },
      select: { id: true, firstName: true, lastName: true, displayName: true, photoUrl: true },
    });

    if (!person) {
      return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const extension = getExtension(file);
    const fileName = `person-${personId}-${Date.now()}.${extension}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "persons");

    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, fileName), buffer);

    const photoUrl = `/uploads/persons/${fileName}`;

    const updated = await prisma.person.update({
      where: { id: personId },
      data: { photoUrl },
      select: { id: true, photoUrl: true },
    });

    await logAction({
      actorUserId: access.session?.user?.effectiveUserId ?? access.session?.user?.id ?? null,
      moduleKey: "people",
      entityType: "Person",
      entityId: personId,
      action: "UPDATE_PHOTO",
      beforeJson: { photoUrl: person.photoUrl },
      afterJson: { photoUrl },
      metadataJson: {
        personName: person.displayName || person.firstName + " " + person.lastName,
      },
    });

    revalidatePath("/dashboard/persons");
    revalidatePath(`/dashboard/persons/${personId}`);

    return NextResponse.json({
      message: "Profilfoto erfolgreich gespeichert.",
      person: updated,
    });
  } catch (error) {
    console.error("Upload person photo failed:", error);

    return NextResponse.json(
      { error: error instanceof Error ? "Technischer Fehler: " + error.message : "Profilfoto konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }
}
