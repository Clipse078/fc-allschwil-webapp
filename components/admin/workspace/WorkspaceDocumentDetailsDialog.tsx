"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import type { WorkspaceDocumentListItemDto } from "@/lib/workspace/document-dto";

import {
  formatWorkspaceDate,
  formatWorkspaceFileSize,
  getWorkspaceFileTypeLabel,
} from "./workspace-document-formatters";

type WorkspaceDocumentDetailsDialogProps = {
  document: WorkspaceDocumentListItemDto;
  open: boolean;
  onClose: () => void;
  onDownload: () => void;
};

type DetailRowProps = {
  label: string;
  value: string;
  title?: string;
};

function DetailRow({
  label,
  value,
  title,
}: DetailRowProps) {
  return (
    <div className="grid gap-1 border-b border-[var(--border)] py-3 last:border-b-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
      <dt className="font-medium text-[var(--text-2)]">
        {label}
      </dt>

      <dd
        className="min-w-0 break-words text-[var(--foreground)]"
        title={title}
      >
        {value}
      </dd>
    </div>
  );
}

function getStatusLabel(status: string): string {
  if (status === "ACTIVE") {
    return "Active";
  }

  if (status === "ARCHIVED") {
    return "Archived";
  }

  return status;
}

export function WorkspaceDocumentDetailsDialog({
  document,
  open,
  onClose,
  onDownload,
}: WorkspaceDocumentDetailsDialogProps) {
  const currentVersion = document.currentVersion;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Document details"
      description={document.name}
      size="lg"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            Close
          </Button>

          <Button
            type="button"
            onClick={onDownload}
            disabled={!currentVersion}
            iconLeft={<Download className="h-4 w-4" />}
          >
            Download
          </Button>
        </>
      }
    >
      <dl>
        <DetailRow
          label="Document name"
          value={document.name}
        />

        <DetailRow
          label="Original filename"
          value={currentVersion?.filename ?? "Not available"}
          title={currentVersion?.filename}
        />

        <DetailRow
          label="File type"
          value={
            currentVersion
              ? getWorkspaceFileTypeLabel(
                  currentVersion.mimeType,
                )
              : "Unknown"
          }
          title={currentVersion?.mimeType}
        />

        <DetailRow
          label="MIME type"
          value={
            currentVersion?.mimeType ?? "Not available"
          }
        />

        <DetailRow
          label="File size"
          value={
            currentVersion
              ? formatWorkspaceFileSize(
                  currentVersion.sizeBytes,
                )
              : "Not available"
          }
        />

        <DetailRow
          label="Created"
          value={formatWorkspaceDate(document.createdAt)}
        />

        <DetailRow
          label="Last updated"
          value={formatWorkspaceDate(document.updatedAt)}
        />

        <DetailRow
          label="Current version"
          value={
            currentVersion
              ? `v${currentVersion.versionNumber}`
              : "No version"
          }
        />

        <DetailRow
          label="Created by"
          value={
            document.createdByUserId ??
            "User information unavailable"
          }
          title={document.createdByUserId ?? undefined}
        />

        <DetailRow
          label="Folder"
          value={
            document.folderId
              ? `Folder ${document.folderId}`
              : "Workspace root"
          }
          title={document.folderId ?? undefined}
        />

        <DetailRow
          label="Status"
          value={getStatusLabel(document.status)}
        />
      </dl>
    </Dialog>
  );
}