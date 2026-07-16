"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requirePermission } from "@/lib/permissions/require-permission";

const MAX_FOLDER_NAME_LENGTH = 120;
const DISPLAY_ORDER_STEP = 10;

function normalizeFolderName(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ");
}

function normalizeFolderId(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function validateFolderName(name: string): void {
  if (!name) {
    throw new Error("Folder name is required.");
  }

  if (name.length > MAX_FOLDER_NAME_LENGTH) {
    throw new Error(
      `Folder name must not exceed ${MAX_FOLDER_NAME_LENGTH} characters.`,
    );
  }
}

export async function createRootWorkspaceFolderAction(
  formData: FormData,
): Promise<void> {
  const session = await requirePermission(PERMISSIONS.WORKSPACE_MANAGE);

  const tenantId = session.user?.tenantId;
  const userId = session.user?.id;

  if (!tenantId || !userId) {
    throw new Error("Authenticated tenant and user are required.");
  }

  const name = normalizeFolderName(formData.get("name"));

  validateFolderName(name);

  const currentMaximum = await prisma.workspaceFolder.aggregate({
    where: {
      tenantId,
      parentId: null,
      archivedAt: null,
    },
    _max: {
      displayOrder: true,
    },
  });

  await prisma.workspaceFolder.create({
    data: {
      tenantId,
      parentId: null,
      name,
      displayOrder:
        (currentMaximum._max.displayOrder ?? 0) + DISPLAY_ORDER_STEP,
      createdByUserId: userId,
      updatedByUserId: userId,
    },
  });

  revalidatePath("/dashboard/workspace");
}

export async function createChildWorkspaceFolderAction(
  formData: FormData,
): Promise<void> {
  const session = await requirePermission(PERMISSIONS.WORKSPACE_MANAGE);

  const tenantId = session.user?.tenantId;
  const userId = session.user?.id;

  if (!tenantId || !userId) {
    throw new Error("Authenticated tenant and user are required.");
  }

  const parentId = normalizeFolderId(formData.get("parentId"));
  const name = normalizeFolderName(formData.get("name"));

  if (!parentId) {
    throw new Error("Parent folder is required.");
  }

  validateFolderName(name);

  const parent = await prisma.workspaceFolder.findFirst({
    where: {
      id: parentId,
      tenantId,
      archivedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!parent) {
    throw new Error("Parent folder was not found.");
  }

  const duplicate = await prisma.workspaceFolder.findFirst({
    where: {
      tenantId,
      parentId: parent.id,
      archivedAt: null,
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  if (duplicate) {
    throw new Error("A folder with this name already exists here.");
  }

  const currentMaximum = await prisma.workspaceFolder.aggregate({
    where: {
      tenantId,
      parentId: parent.id,
      archivedAt: null,
    },
    _max: {
      displayOrder: true,
    },
  });

  await prisma.workspaceFolder.create({
    data: {
      tenantId,
      parentId: parent.id,
      name,
      displayOrder:
        (currentMaximum._max.displayOrder ?? 0) + DISPLAY_ORDER_STEP,
      createdByUserId: userId,
      updatedByUserId: userId,
    },
  });

  revalidatePath("/dashboard/workspace");
}
export async function renameWorkspaceFolderAction(
  formData: FormData,
): Promise<void> {
  const session = await requirePermission(PERMISSIONS.WORKSPACE_MANAGE);

  const tenantId = session.user?.tenantId;
  const userId = session.user?.id;

  if (!tenantId || !userId) {
    throw new Error("Authenticated tenant and user are required.");
  }

  const folderId = normalizeFolderId(formData.get("folderId"));
  const name = normalizeFolderName(formData.get("name"));

  if (!folderId) {
    throw new Error("Folder is required.");
  }

  validateFolderName(name);

  const folder = await prisma.workspaceFolder.findFirst({
    where: {
      id: folderId,
      tenantId,
      archivedAt: null,
    },
    select: {
      id: true,
      parentId: true,
      name: true,
    },
  });

  if (!folder) {
    throw new Error("Folder was not found.");
  }

  if (folder.name === name) {
    revalidatePath("/dashboard/workspace");
    return;
  }

  const duplicate = await prisma.workspaceFolder.findFirst({
    where: {
      tenantId,
      parentId: folder.parentId,
      archivedAt: null,
      id: {
        not: folder.id,
      },
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  if (duplicate) {
    throw new Error("A folder with this name already exists here.");
  }

  const updated = await prisma.workspaceFolder.updateMany({
    where: {
      id: folder.id,
      tenantId,
      archivedAt: null,
    },
    data: {
      name,
      updatedByUserId: userId,
    },
  });

  if (updated.count !== 1) {
    throw new Error("Folder could not be renamed.");
  }

  revalidatePath("/dashboard/workspace");
}
export async function archiveWorkspaceFolderAction(
  formData: FormData,
): Promise<void> {
  const session = await requirePermission(PERMISSIONS.WORKSPACE_MANAGE);

  const tenantId = session.user?.tenantId;
  const userId = session.user?.id;

  if (!tenantId || !userId) {
    throw new Error("Authenticated tenant and user are required.");
  }

  const folderId = normalizeFolderId(formData.get("folderId"));

  if (!folderId) {
    throw new Error("Folder is required.");
  }

  const folder = await prisma.workspaceFolder.findFirst({
    where: {
      id: folderId,
      tenantId,
      archivedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!folder) {
    throw new Error("Folder was not found.");
  }

  const activeChildCount = await prisma.workspaceFolder.count({
    where: {
      tenantId,
      parentId: folder.id,
      archivedAt: null,
    },
  });

  if (activeChildCount > 0) {
    throw new Error(
      "This folder cannot be archived while it contains active subfolders.",
    );
  }

  const archived = await prisma.workspaceFolder.updateMany({
    where: {
      id: folder.id,
      tenantId,
      archivedAt: null,
    },
    data: {
      archivedAt: new Date(),
      updatedByUserId: userId,
    },
  });

  if (archived.count !== 1) {
    throw new Error("Folder could not be archived.");
  }

  revalidatePath("/dashboard/workspace");
}
export async function restoreWorkspaceFolderAction(
  formData: FormData,
): Promise<void> {
  const session = await requirePermission(PERMISSIONS.WORKSPACE_MANAGE);

  const tenantId = session.user?.tenantId;
  const userId = session.user?.id;

  if (!tenantId || !userId) {
    throw new Error("Authenticated tenant and user are required.");
  }

  const folderId = normalizeFolderId(formData.get("folderId"));

  if (!folderId) {
    throw new Error("Folder is required.");
  }

  const folder = await prisma.workspaceFolder.findFirst({
    where: {
      id: folderId,
      tenantId,
      archivedAt: {
        not: null,
      },
    },
    select: {
      id: true,
      parentId: true,
      name: true,
    },
  });

  if (!folder) {
    throw new Error("Archived folder was not found.");
  }

  if (folder.parentId) {
    const parent = await prisma.workspaceFolder.findFirst({
      where: {
        id: folder.parentId,
        tenantId,
      },
      select: {
        archivedAt: true,
      },
    });

    if (!parent) {
      throw new Error("Parent folder was not found.");
    }

    if (parent.archivedAt) {
      throw new Error(
        "Restore the parent folder before restoring this folder.",
      );
    }
  }

  const duplicate = await prisma.workspaceFolder.findFirst({
    where: {
      tenantId,
      parentId: folder.parentId,
      archivedAt: null,
      id: {
        not: folder.id,
      },
      name: {
        equals: folder.name,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  if (duplicate) {
    throw new Error(
      "An active folder with this name already exists in this location.",
    );
  }

  const restored = await prisma.workspaceFolder.updateMany({
    where: {
      id: folder.id,
      tenantId,
      archivedAt: {
        not: null,
      },
    },
    data: {
      archivedAt: null,
      updatedByUserId: userId,
    },
  });

  if (restored.count !== 1) {
    throw new Error("Folder could not be restored.");
  }

  revalidatePath("/dashboard/workspace");
}
