export interface WorkspaceFolderRecord {
  id: string;
  parentId: string | null;
  name: string;
  description: string | null;
  displayOrder: number;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceFolderDto {
  id: string;
  parentId: string | null;
  name: string;
  description: string | null;
  displayOrder: number;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceFolderListResponseDto {
  folders: WorkspaceFolderDto[];
}

export interface CreateWorkspaceFolderRequestDto {
  parentId?: string | null;
  name: string;
  description?: string | null;
  displayOrder?: number;
}

export interface ListWorkspaceFoldersInput {
  tenantId: string;
  parentId?: string | null;
}

export interface CreateWorkspaceFolderInput {
  tenantId: string;
  parentId?: string | null;
  name: string;
  description?: string | null;
  displayOrder?: number;
  actorUserId: string;
}

export interface CreateWorkspaceFolderResponseDto {
  folder: WorkspaceFolderDto;
}

export function toWorkspaceFolderDto(
  folder: WorkspaceFolderRecord,
): WorkspaceFolderDto {
  return {
    id: folder.id,
    parentId: folder.parentId,
    name: folder.name,
    description: folder.description,
    displayOrder: folder.displayOrder,
    createdByUserId: folder.createdByUserId,
    updatedByUserId: folder.updatedByUserId,
    archivedAt: folder.archivedAt?.toISOString() ?? null,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt.toISOString(),
  };
}

export function toWorkspaceFolderListResponseDto(
  folders: WorkspaceFolderRecord[],
): WorkspaceFolderListResponseDto {
  return {
    folders: folders.map(toWorkspaceFolderDto),
  };
}

export function toCreateWorkspaceFolderResponseDto(
  folder: WorkspaceFolderRecord,
): CreateWorkspaceFolderResponseDto {
  return {
    folder: toWorkspaceFolderDto(folder),
  };
}