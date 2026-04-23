import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .trim();
}

async function getUniqueRoleKey(baseKey: string, excludeId?: string) {
  let candidate = baseKey || "role";
  let suffix = 2;

  while (true) {
    const existing = await prisma.role.findUnique({
      where: { key: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === excludeId) {
      return candidate;
    }

    candidate = `${baseKey || "role"}_${suffix}`;
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
    const departmentId = String(body.departmentId ?? "").trim();
    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const isGroupRole = Boolean(body.isGroupRole);

    if (!departmentId) {
      return NextResponse.json(
        { error: "Bitte wähle zuerst einen Bereich aus." },
        { status: 400 },
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "Bitte gib einen Rollennamen ein." },
        { status: 400 },
      );
    }

    const department = await prisma.organigrammDepartment.findUnique({
      where: { id: departmentId },
      select: { id: true, name: true },
    });

    if (!department) {
      return NextResponse.json(
        { error: "Der ausgewählte Bereich wurde nicht gefunden." },
        { status: 404 },
      );
    }

    const lastRole = await prisma.role.findFirst({
      where: {
        organigrammDepartmentId: departmentId,
      },
      orderBy: [{ organigrammSortOrder: "desc" }],
      select: { organigrammSortOrder: true },
    });

    const key = await getUniqueRoleKey(slugify(name));

    const role = await prisma.role.create({
      data: {
        key,
        name,
        description: description || null,
        canAccessVereinsleitung: false,
        canAttendVereinsleitungMeetings: false,
        organigrammDepartmentId: departmentId,
        organigrammDisplayName: name,
        organigrammDescription: description || null,
        organigrammSortOrder: (lastRole?.organigrammSortOrder ?? 0) + 10,
        organigrammIsGroupRole: isGroupRole,
      },
      select: {
        id: true,
        name: true,
      },
    });

    return NextResponse.json(
      {
        id: role.id,
        message: `Rolle "${role.name}" wurde erstellt.`,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create organigramm role failed:", error);

    return NextResponse.json(
      { error: "Rolle konnte nicht erstellt werden." },
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
    const roleId = String(body.roleId ?? "").trim();
    const departmentIdRaw = body.departmentId;
    const departmentId =
      typeof departmentIdRaw === "string" ? departmentIdRaw.trim() : "";
    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const isGroupRole = Boolean(body.isGroupRole);

    if (!roleId) {
      return NextResponse.json(
        { error: "Rolle konnte nicht zugeordnet werden." },
        { status: 400 },
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "Bitte gib einen Rollennamen ein." },
        { status: 400 },
      );
    }

    const existingRole = await prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true },
    });

    if (!existingRole) {
      return NextResponse.json(
        { error: "Rolle wurde nicht gefunden." },
        { status: 404 },
      );
    }

    if (departmentId) {
      const department = await prisma.organigrammDepartment.findUnique({
        where: { id: departmentId },
        select: { id: true },
      });

      if (!department) {
        return NextResponse.json(
          { error: "Der ausgewählte Bereich wurde nicht gefunden." },
          { status: 404 },
        );
      }
    }

    const key = await getUniqueRoleKey(slugify(name), roleId);

    const role = await prisma.role.update({
      where: { id: roleId },
      data: {
        key,
        name,
        description: description || null,
        organigrammDepartmentId: departmentId || null,
        organigrammDisplayName: name,
        organigrammDescription: description || null,
        organigrammIsGroupRole: isGroupRole,
      },
      select: {
        id: true,
        name: true,
      },
    });

    return NextResponse.json({
      id: role.id,
      message: `Rolle "${role.name}" wurde aktualisiert.`,
    });
  } catch (error) {
    console.error("Update organigramm role failed:", error);

    return NextResponse.json(
      { error: "Rolle konnte nicht aktualisiert werden." },
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
    const roleId = String(body.roleId ?? "").trim();

    if (!roleId) {
      return NextResponse.json(
        { error: "Rolle konnte nicht zugeordnet werden." },
        { status: 400 },
      );
    }

    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            userRoles: true,
            rolePermissions: true,
            workflowRules: true,
            workflowReviewAssignments: true,
          },
        },
      },
    });

    if (!role) {
      return NextResponse.json(
        { error: "Rolle wurde nicht gefunden." },
        { status: 404 },
      );
    }

    const dependencyCount =
      role._count.userRoles +
      role._count.rolePermissions +
      role._count.workflowRules +
      role._count.workflowReviewAssignments;

    if (dependencyCount > 0) {
      await prisma.role.update({
        where: { id: roleId },
        data: {
          organigrammDepartmentId: null,
          organigrammDisplayName: null,
          organigrammDescription: null,
        },
      });

      return NextResponse.json({
        message:
          `Rolle "${role.name}" wurde aus dem Organigramm entfernt, bleibt aber wegen bestehender Zuweisungen und Berechtigungen im System erhalten.`,
      });
    }

    await prisma.role.delete({
      where: { id: roleId },
    });

    return NextResponse.json({
      message: `Rolle "${role.name}" wurde gelöscht.`,
    });
  } catch (error) {
    console.error("Delete organigramm role failed:", error);

    return NextResponse.json(
      { error: "Rolle konnte nicht entfernt werden." },
      { status: 500 },
    );
  }
}
