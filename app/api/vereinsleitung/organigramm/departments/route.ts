import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
}

async function getUniqueDepartmentKey(baseKey: string, excludeId?: string) {
  let candidate = baseKey || "department";
  let suffix = 2;

  while (true) {
    const existing = await prisma.organigrammDepartment.findUnique({
      where: { key: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === excludeId) {
      return candidate;
    }

    candidate = `${baseKey || "department"}-${suffix}`;
    suffix += 1;
  }
}

export async function POST(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();

    if (!name) {
      return NextResponse.json(
        { error: "Bitte gib einen Bereichsnamen ein." },
        { status: 400 },
      );
    }

    const lastDepartment = await prisma.organigrammDepartment.findFirst({
      orderBy: [{ sortOrder: "desc" }],
      select: { sortOrder: true },
    });

    const key = await getUniqueDepartmentKey(slugify(name));

    const department = await prisma.organigrammDepartment.create({
      data: {
        key,
        name,
        description: description || null,
        sortOrder: (lastDepartment?.sortOrder ?? 0) + 10,
      },
      select: {
        id: true,
        name: true,
      },
    });

    return NextResponse.json(
      {
        id: department.id,
        message: `Bereich "${department.name}" wurde erstellt.`,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create organigramm department failed:", error);

    return NextResponse.json(
      { error: "Bereich konnte nicht erstellt werden." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await request.json();
    const departmentId = String(body.departmentId ?? "").trim();
    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();

    if (!departmentId) {
      return NextResponse.json(
        { error: "Bereich konnte nicht zugeordnet werden." },
        { status: 400 },
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "Bitte gib einen Bereichsnamen ein." },
        { status: 400 },
      );
    }

    const existing = await prisma.organigrammDepartment.findUnique({
      where: { id: departmentId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Bereich wurde nicht gefunden." },
        { status: 404 },
      );
    }

    const key = await getUniqueDepartmentKey(slugify(name), departmentId);

    const department = await prisma.organigrammDepartment.update({
      where: { id: departmentId },
      data: {
        key,
        name,
        description: description || null,
      },
      select: {
        id: true,
        name: true,
      },
    });

    return NextResponse.json({
      id: department.id,
      message: `Bereich "${department.name}" wurde aktualisiert.`,
    });
  } catch (error) {
    console.error("Update organigramm department failed:", error);

    return NextResponse.json(
      { error: "Bereich konnte nicht aktualisiert werden." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await request.json();
    const departmentId = String(body.departmentId ?? "").trim();

    if (!departmentId) {
      return NextResponse.json(
        { error: "Bereich konnte nicht zugeordnet werden." },
        { status: 400 },
      );
    }

    const department = await prisma.organigrammDepartment.findUnique({
      where: { id: departmentId },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            roles: true,
          },
        },
      },
    });

    if (!department) {
      return NextResponse.json(
        { error: "Bereich wurde nicht gefunden." },
        { status: 404 },
      );
    }

    if (department._count.roles > 0) {
      return NextResponse.json(
        {
          error:
            "Bereich kann nicht gelöscht werden, solange noch Rollen darin enthalten sind. Bitte zuerst Rollen verschieben oder archivieren.",
        },
        { status: 400 },
      );
    }

    await prisma.organigrammDepartment.update({
      where: { id: departmentId },
      data: {
        isActive: false,
      },
    });

    return NextResponse.json({
      message: `Bereich "${department.name}" wurde archiviert.`,
    });
  } catch (error) {
    console.error("Delete organigramm department failed:", error);

    return NextResponse.json(
      { error: "Bereich konnte nicht archiviert werden." },
      { status: 500 },
    );
  }
}
