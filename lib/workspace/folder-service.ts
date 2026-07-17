import { prisma } from "@/lib/db/prisma";
import {
  type CreateWorkspaceFolderInput,
  type ListWorkspaceFoldersInput,
  type WorkspaceFolderRecord,
} from "@/lib/workspace/folder-dto";

export type WorkspaceFolderServiceErrorCode =
  | "INVALID_INPUT"
  | "PARENT_FOLDER_NOT_FOUND"
  | "DUPLICATE_FOLDER_NAME";

export class WorkspaceFolderServiceError extends Error {
  constructor(
    public readonly code: WorkspaceFolderServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceFolderServiceError";
  }
}

function normalizeRequiredText(
  value: string,
  fieldName: string,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new WorkspaceFolderServiceError(
      "INVALID_INPUT",
      `${fieldName} ist erforderlich.`,
    );
  }

  return normalized;
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (value == null) {
    return null;
  }

  const normalized = value.trim();

  return normalized || null;
}

function normalizeOptionalId(
  value: string | null | undefined,
): string | null {
  if (value == null) {
    return null;
  }

  const normalized = value.trim();

  return normalized || null;
}

function normalizeDisplayOrder(
  value: number | undefined,
): number {
  if (value == null) {
    return 0;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new WorkspaceFolderServiceError(
      "INVALID_INPUT",
      "displayOrder muss eine nichtnegative Ganzzahl sein.",
    );
  }

  return value;
}

async function assertParentFolderExists(
  tenantId: string,
  parentId: string | null,
): Promise<void> {
  if (!parentId) {
    return;
  }

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
    throw new WorkspaceFolderServiceError(
      "PARENT_FOLDER_NOT_FOUND",
      "Ãœbergeordneter Workspace-Ordner wurde nicht gefunden.",
    );
  }
}

async function assertFolderNameAvailable(input: {
  tenantId: string;
  parentId: string | null;
  name: string;
}): Promise<void> {
  const duplicate = await prisma.workspaceFolder.findFirst({
    where: {
      tenantId: input.tenantId,
      parentId: input.parentId,
      name: input.name,
      archivedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (duplicate) {
    throw new WorkspaceFolderServiceError(
      "DUPLICATE_FOLDER_NAME",
      "Ein Workspace-Ordner mit diesem Namen existiert bereits.",
    );
  }
}

export async function listWorkspaceFolders(
  input: ListWorkspaceFoldersInput,
): Promise<WorkspaceFolderRecord[]> {
  const tenantId = normalizeRequiredText(
    input.tenantId,
    "tenantId",
  );

  const parentId = normalizeOptionalId(input.parentId);

  if (parentId) {
    await assertParentFolderExists(
      tenantId,
      parentId,
    );
  }

  return prisma.workspaceFolder.findMany({
    where: {
      tenantId,
      parentId,
      archivedAt: null,
    },
    orderBy: [
      {
        displayOrder: "asc",
      },
      {
        name: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
    select: {
      id: true,
      parentId: true,
      name: true,
      description: true,
      displayOrder: true,
      createdByUserId: true,
      updatedByUserId: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function createWorkspaceFolder(
  input: CreateWorkspaceFolderInput,
): Promise<WorkspaceFolderRecord> {
  const tenantId = normalizeRequiredText(
    input.tenantId,
    "tenantId",
  );

  const actorUserId = normalizeRequiredText(
    input.actorUserId,
    "actorUserId",
  );

  const parentId = normalizeOptionalId(input.parentId);
  const name = normalizeRequiredText(input.name, "name");
  const description = normalizeOptionalText(
    input.description,
  );
  const displayOrder = normalizeDisplayOrder(
    input.displayOrder,
  );

  await assertParentFolderExists(
    tenantId,
    parentId,
  );

  await assertFolderNameAvailable({
    tenantId,
    parentId,
    name,
  });

  return prisma.workspaceFolder.create({
    data: {
      tenantId,
      parentId,
      name,
      description,
      displayOrder,
      createdByUserId: actorUserId,
      updatedByUserId: actorUserId,
    },
    select: {
      id: true,
      parentId: true,
      name: true,
      description: true,
      displayOrder: true,
      createdByUserId: true,
      updatedByUserId: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}