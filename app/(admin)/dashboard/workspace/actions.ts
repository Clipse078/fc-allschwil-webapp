"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { normalizeWorkspaceFolderName } from "@/lib/workspace/folder-service";

const MAX_FOLDER_NAME_LENGTH = 120;
const DISPLAY_ORDER_STEP = 10;

// ---------------------------------------------------------------------------
// Typed result types
// ---------------------------------------------------------------------------

export type WorkspaceFolderErrorCode =
  | "WORKSPACE_FOLDER_NAME_REQUIRED"
  | "WORKSPACE_FOLDER_NAME_INVALID"
  | "WORKSPACE_FOLDER_NAME_CONFLICT"
  | "WORKSPACE_FOLDER_NOT_FOUND"
  | "WORKSPACE_FORBIDDEN"
  | "WORKSPACE_FOLDER_CREATE_FAILED"
  | "WORKSPACE_FOLDER_RENAME_FAILED"
  | "WORKSPACE_FOLDER_MOVE_FAILED"
  | "WORKSPACE_FOLDER_ARCHIVE_FAILED"
  | "WORKSPACE_FOLDER_RESTORE_FAILED";

export type WorkspaceFolderActionSuccess<T = void> = {
  ok: true;
  data: T;
};

export type WorkspaceFolderActionFailure = {
  ok: false;
  code: WorkspaceFolderErrorCode;
  message?: string;
};

export type WorkspaceFolderActionResult<T = void> =
  | WorkspaceFolderActionSuccess<T>
  | WorkspaceFolderActionFailure;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

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

type ValidateFolderNameResult =
  | { ok: true; name: string }
  | { ok: false; code: WorkspaceFolderErrorCode; message: string };

function validateFolderName(name: string): ValidateFolderNameResult {
  if (!name) {
    return {
      ok: false,
      code: "WORKSPACE_FOLDER_NAME_REQUIRED",
      message: "Folder name is required.",
    };
  }

  if (name.length > MAX_FOLDER_NAME_LENGTH) {
    return {
      ok: false,
      code: "WORKSPACE_FOLDER_NAME_INVALID",
      message: `Folder name must not exceed ${MAX_FOLDER_NAME_LENGTH} characters.`,
    };
  }

  return { ok: true, name };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function createRootWorkspaceFolderAction(
  formData: FormData,
): Promise<WorkspaceFolderActionResult<{ id: string }>> {
  let session;

  try {
    session = await requirePermission(PERMISSIONS.WORKSPACE_MANAGE);
  } catch {
    return {
      ok: false,
      code: "WORKSPACE_FORBIDDEN",
      message: "You do not have permission to create folders.",
    };
  }

  const tenantId = session.user?.activeTenantId;
  const userId = session.user?.id;

  if (!tenantId || !userId) {
    return {
      ok: false,
      code: "WORKSPACE_FORBIDDEN",
      message: "Authenticated tenant and user are required.",
    };
  }

  const name = normalizeFolderName(formData.get("name"));
  const validation = validateFolderName(name);

  if (!validation.ok) {
    return { ok: false, code: validation.code, message: validation.message };
  }

  try {
    const duplicate = await prisma.workspaceFolder.findFirst({
      where: {
        tenantId,
        parentId: null,
        archivedAt: null,
        name: {
          equals: normalizeWorkspaceFolderName(name),
          mode: "insensitive",
        },
      },
      select: {
        id: true,
      },
    });

    if (duplicate) {
      return {
        ok: false,
        code: "WORKSPACE_FOLDER_NAME_CONFLICT",
        message: "Folder name already exists. Choose another name.",
      };
    }

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

    const folder = await prisma.workspaceFolder.create({
      data: {
        tenantId,
        parentId: null,
        name,
        displayOrder:
          (currentMaximum._max.displayOrder ?? 0) + DISPLAY_ORDER_STEP,
        createdByUserId: userId,
        updatedByUserId: userId,
      },
      select: {
        id: true,
      },
    });

    revalidatePath("/dashboard/workspace");
    return { ok: true, data: { id: folder.id } };
  } catch (error) {
    console.error("[workspace-actions] createRootWorkspaceFolder failed", error);

    return {
      ok: false,
      code: "WORKSPACE_FOLDER_CREATE_FAILED",
      message: "The folder could not be created. Please try again.",
    };
  }
}

export async function createChildWorkspaceFolderAction(
  formData: FormData,
): Promise<WorkspaceFolderActionResult<void>> {
  let session;

  try {
    session = await requirePermission(PERMISSIONS.WORKSPACE_MANAGE);
  } catch {
    return {
      ok: false,
      code: "WORKSPACE_FORBIDDEN",
      message: "You do not have permission to create folders.",
    };
  }

  const tenantId = session.user?.activeTenantId;
  const userId = session.user?.id;

  if (!tenantId || !userId) {
    return {
      ok: false,
      code: "WORKSPACE_FORBIDDEN",
      message: "Authenticated tenant and user are required.",
    };
  }

  const parentId = normalizeFolderId(formData.get("parentId"));
  const name = normalizeFolderName(formData.get("name"));

  if (!parentId) {
    return {
      ok: false,
      code: "WORKSPACE_FOLDER_NOT_FOUND",
      message: "Parent folder is required.",
    };
  }

  const validation = validateFolderName(name);

  if (!validation.ok) {
    return { ok: false, code: validation.code, message: validation.message };
  }

  try {
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
      return {
        ok: false,
        code: "WORKSPACE_FOLDER_NOT_FOUND",
        message: "Parent folder was not found.",
      };
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
      return {
        ok: false,
        code: "WORKSPACE_FOLDER_NAME_CONFLICT",
        message: "Folder name already exists. Choose another name.",
      };
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
    return { ok: true, data: undefined };
  } catch (error) {
    console.error("[workspace-actions] createChildWorkspaceFolder failed", error);

    return {
      ok: false,
      code: "WORKSPACE_FOLDER_CREATE_FAILED",
      message: "The folder could not be created. Please try again.",
    };
  }
}

export async function renameWorkspaceFolderAction(
  formData: FormData,
): Promise<WorkspaceFolderActionResult<void>> {
  let session;

  try {
    session = await requirePermission(PERMISSIONS.WORKSPACE_MANAGE);
  } catch {
    return {
      ok: false,
      code: "WORKSPACE_FORBIDDEN",
      message: "You do not have permission to rename folders.",
    };
  }

  const tenantId = session.user?.activeTenantId;
  const userId = session.user?.id;

  if (!tenantId || !userId) {
    return {
      ok: false,
      code: "WORKSPACE_FORBIDDEN",
      message: "Authenticated tenant and user are required.",
    };
  }

  const folderId = normalizeFolderId(formData.get("folderId"));
  const name = normalizeFolderName(formData.get("name"));

  if (!folderId) {
    return {
      ok: false,
      code: "WORKSPACE_FOLDER_NOT_FOUND",
      message: "Folder is required.",
    };
  }

  const validation = validateFolderName(name);

  if (!validation.ok) {
    return { ok: false, code: validation.code, message: validation.message };
  }

  try {
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
      return {
        ok: false,
        code: "WORKSPACE_FOLDER_NOT_FOUND",
        message: "Folder was not found.",
      };
    }

    if (folder.name === name) {
      revalidatePath("/dashboard/workspace");
      return { ok: true, data: undefined };
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
      return {
        ok: false,
        code: "WORKSPACE_FOLDER_NAME_CONFLICT",
        message: "Folder name already exists. Choose another name.",
      };
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
      return {
        ok: false,
        code: "WORKSPACE_FOLDER_RENAME_FAILED",
        message: "Folder could not be renamed.",
      };
    }

    revalidatePath("/dashboard/workspace");
    return { ok: true, data: undefined };
  } catch (error) {
    console.error("[workspace-actions] renameWorkspaceFolder failed", error);

    return {
      ok: false,
      code: "WORKSPACE_FOLDER_RENAME_FAILED",
      message: "The folder could not be renamed. Please try again.",
    };
  }
}

export async function archiveWorkspaceFolderAction(
  formData: FormData,
): Promise<WorkspaceFolderActionResult<void>> {
  let session;

  try {
    session = await requirePermission(PERMISSIONS.WORKSPACE_MANAGE);
  } catch {
    return {
      ok: false,
      code: "WORKSPACE_FORBIDDEN",
      message: "You do not have permission to archive folders.",
    };
  }

  const tenantId = session.user?.activeTenantId;
  const userId = session.user?.id;

  if (!tenantId || !userId) {
    return {
      ok: false,
      code: "WORKSPACE_FORBIDDEN",
      message: "Authenticated tenant and user are required.",
    };
  }

  const folderId = normalizeFolderId(formData.get("folderId"));

  if (!folderId) {
    return {
      ok: false,
      code: "WORKSPACE_FOLDER_NOT_FOUND",
      message: "Folder is required.",
    };
  }

  try {
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
      return {
        ok: false,
        code: "WORKSPACE_FOLDER_NOT_FOUND",
        message: "Folder was not found.",
      };
    }

    const activeChildCount = await prisma.workspaceFolder.count({
      where: {
        tenantId,
        parentId: folder.id,
        archivedAt: null,
      },
    });

    if (activeChildCount > 0) {
      return {
        ok: false,
        code: "WORKSPACE_FOLDER_ARCHIVE_FAILED",
        message:
          "This folder cannot be archived while it contains active subfolders.",
      };
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
      return {
        ok: false,
        code: "WORKSPACE_FOLDER_ARCHIVE_FAILED",
        message: "Folder could not be archived.",
      };
    }

    revalidatePath("/dashboard/workspace");
    return { ok: true, data: undefined };
  } catch (error) {
    console.error("[workspace-actions] archiveWorkspaceFolder failed", error);

    return {
      ok: false,
      code: "WORKSPACE_FOLDER_ARCHIVE_FAILED",
      message: "The folder could not be archived. Please try again.",
    };
  }
}

export async function restoreWorkspaceFolderAction(
  formData: FormData,
): Promise<WorkspaceFolderActionResult<void>> {
  let session;

  try {
    session = await requirePermission(PERMISSIONS.WORKSPACE_MANAGE);
  } catch {
    return {
      ok: false,
      code: "WORKSPACE_FORBIDDEN",
      message: "You do not have permission to restore folders.",
    };
  }

  const tenantId = session.user?.activeTenantId;
  const userId = session.user?.id;

  if (!tenantId || !userId) {
    return {
      ok: false,
      code: "WORKSPACE_FORBIDDEN",
      message: "Authenticated tenant and user are required.",
    };
  }

  const folderId = normalizeFolderId(formData.get("folderId"));

  if (!folderId) {
    return {
      ok: false,
      code: "WORKSPACE_FOLDER_NOT_FOUND",
      message: "Folder is required.",
    };
  }

  try {
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
      return {
        ok: false,
        code: "WORKSPACE_FOLDER_NOT_FOUND",
        message: "Archived folder was not found.",
      };
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
        return {
          ok: false,
          code: "WORKSPACE_FOLDER_NOT_FOUND",
          message: "Parent folder was not found.",
        };
      }

      if (parent.archivedAt) {
        return {
          ok: false,
          code: "WORKSPACE_FOLDER_RESTORE_FAILED",
          message: "Restore the parent folder before restoring this folder.",
        };
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
      return {
        ok: false,
        code: "WORKSPACE_FOLDER_NAME_CONFLICT",
        message: "Folder name already exists. Choose another name.",
      };
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
      return {
        ok: false,
        code: "WORKSPACE_FOLDER_RESTORE_FAILED",
        message: "Folder could not be restored.",
      };
    }

    revalidatePath("/dashboard/workspace");
    return { ok: true, data: undefined };
  } catch (error) {
    console.error("[workspace-actions] restoreWorkspaceFolder failed", error);

    return {
      ok: false,
      code: "WORKSPACE_FOLDER_RESTORE_FAILED",
      message: "The folder could not be restored. Please try again.",
    };
  }
}

async function isWorkspaceFolderDescendantOf(
  tenantId: string,
  candidateFolderId: string,
  rootFolderId: string,
): Promise<boolean> {
  let currentId: string | null = candidateFolderId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === rootFolderId) {
      return true;
    }

    if (visited.has(currentId)) {
      throw new Error("The Workspace folder hierarchy contains a cycle.");
    }

    visited.add(currentId);

    const currentFolder: { parentId: string | null } | null =
      await prisma.workspaceFolder.findFirst({
        where: {
          id: currentId,
          tenantId,
        },
        select: {
          parentId: true,
        },
      });

    if (!currentFolder) {
      return false;
    }

    currentId = currentFolder.parentId;
  }

  return false;
}

export async function moveWorkspaceFolderAction(
  formData: FormData,
): Promise<WorkspaceFolderActionResult<void>> {
  let session;

  try {
    session = await requirePermission(PERMISSIONS.WORKSPACE_MANAGE);
  } catch {
    return {
      ok: false,
      code: "WORKSPACE_FORBIDDEN",
      message: "You do not have permission to move folders.",
    };
  }

  const tenantId = session.user?.activeTenantId;
  const userId = session.user?.id;

  if (!tenantId || !userId) {
    return {
      ok: false,
      code: "WORKSPACE_FORBIDDEN",
      message: "Authenticated tenant and user are required.",
    };
  }

  const folderId = normalizeFolderId(formData.get("folderId"));
  const requestedParentId = normalizeFolderId(formData.get("parentId"));
  const newParentId = requestedParentId || null;

  if (!folderId) {
    return {
      ok: false,
      code: "WORKSPACE_FOLDER_NOT_FOUND",
      message: "Folder is required.",
    };
  }

  try {
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
      return {
        ok: false,
        code: "WORKSPACE_FOLDER_NOT_FOUND",
        message: "Folder was not found.",
      };
    }

    if (newParentId === folder.id) {
      return {
        ok: false,
        code: "WORKSPACE_FOLDER_MOVE_FAILED",
        message: "A folder cannot be moved into itself.",
      };
    }

    if (newParentId === folder.parentId) {
      revalidatePath("/dashboard/workspace");
      return { ok: true, data: undefined };
    }

    if (newParentId) {
      const targetFolder = await prisma.workspaceFolder.findFirst({
        where: {
          id: newParentId,
          tenantId,
          archivedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (!targetFolder) {
        return {
          ok: false,
          code: "WORKSPACE_FOLDER_NOT_FOUND",
          message: "Target folder was not found or is unavailable.",
        };
      }

      const targetIsDescendant = await isWorkspaceFolderDescendantOf(
        tenantId,
        targetFolder.id,
        folder.id,
      );

      if (targetIsDescendant) {
        return {
          ok: false,
          code: "WORKSPACE_FOLDER_MOVE_FAILED",
          message: "A folder cannot be moved into one of its descendants.",
        };
      }
    }

    const duplicate = await prisma.workspaceFolder.findFirst({
      where: {
        tenantId,
        parentId: newParentId,
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
      return {
        ok: false,
        code: "WORKSPACE_FOLDER_NAME_CONFLICT",
        message: "Folder name already exists. Choose another name.",
      };
    }

    const moved = await prisma.workspaceFolder.updateMany({
      where: {
        id: folder.id,
        tenantId,
        archivedAt: null,
      },
      data: {
        parentId: newParentId,
        updatedByUserId: userId,
      },
    });

    if (moved.count !== 1) {
      return {
        ok: false,
        code: "WORKSPACE_FOLDER_MOVE_FAILED",
        message: "Folder could not be moved.",
      };
    }

    revalidatePath("/dashboard/workspace");
    return { ok: true, data: undefined };
  } catch (error) {
    console.error("[workspace-actions] moveWorkspaceFolder failed", error);

    return {
      ok: false,
      code: "WORKSPACE_FOLDER_MOVE_FAILED",
      message: "The folder could not be moved. Please try again.",
    };
  }
}
