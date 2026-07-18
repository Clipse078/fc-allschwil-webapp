import type {
  WorkspaceDocumentStatus,
  WorkspaceDocumentVersionStatus,
} from "@prisma/client";

export type WorkspaceDocumentVersionDto = {
  id: string;
  documentId: string;
  versionNumber: number;
  status: WorkspaceDocumentVersionStatus;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  storageUrl: string | null;
  checksum: string | null;
  changeNote: string | null;
  createdByUserId: string | null;
  createdAt: Date;
};

export type WorkspaceDocumentDto = {
  id: string;
  tenantId: string;
  folderId: string | null;
  name: string;
  status: WorkspaceDocumentStatus;
  currentVersionId: string | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  currentVersion: WorkspaceDocumentVersionDto | null;
};

export type CreateWorkspaceDocumentInput = {
  documentId: string;
  tenantId: string;
  folderId: string | null;
  name: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  storageUrl?: string | null;
  checksum?: string | null;
  changeNote?: string | null;
  actorUserId: string;
};
export type WorkspaceDocumentListVersionDto = {
  id: string;
  versionNumber: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
};

export type WorkspaceDocumentListItemDto = {
  id: string;
  folderId: string | null;
  name: string;
  status: WorkspaceDocumentStatus;
  currentVersionId: string | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  currentVersion: WorkspaceDocumentListVersionDto | null;
};

export type ListWorkspaceDocumentsInput = {
  tenantId: string;
  folderId?: string | null;
};

export type GetWorkspaceDocumentForDownloadInput = {
  tenantId: string;
  documentId: string;
};

export type WorkspaceDocumentDownloadDto = {
  documentId: string;
  documentName: string;
  versionId: string;
  versionNumber: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  checksum: string | null;
};
export type GetWorkspaceDocumentVersionsInput = {
  tenantId: string;
  actorUserId: string;
  documentId: string;
};

export type WorkspaceDocumentVersionHistoryItemDto = {
  id: string;
  versionNumber: number;
  createdAt: Date;
  createdByUserId: string | null;
  createdByName: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string | null;
  status: WorkspaceDocumentVersionStatus;
  isCurrent: boolean;
};
