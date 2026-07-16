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
