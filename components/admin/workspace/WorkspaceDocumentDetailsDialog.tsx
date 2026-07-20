"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import type { WorkspaceDocumentListItemDto } from "@/lib/workspace/document-dto";
import { getWorkspaceFileGermanLabel } from "@/lib/workspace/file-type-util";
import { workspaceDE } from "@/lib/workspace/workspace-i18n";

import {
  formatWorkspaceDate,
  formatWorkspaceFileSize,
} from "./workspace-document-formatters";

const t = workspaceDE.preview;

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

function DetailRow({ label, value, title }: DetailRowProps) {
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
      title="Dokumentdetails"
      description={document.name}
      size="lg"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            Schliessen
          </Button>

          <Button
            type="button"
            onClick={onDownload}
            disabled={!currentVersion}
            iconLeft={<Download className="h-4 w-4" />}
          >
            {t.downloadButton}
          </Button>
        </>
      }
    >
      <dl>
        <DetailRow
          label={t.labels.name}
          value={document.name}
        />

        {currentVersion?.filename &&
        currentVersion.filename !== document.name ? (
          <DetailRow
            label={t.labels.filename}
            value={currentVersion.filename}
            title={currentVersion.filename}
          />
        ) : null}

        <DetailRow
          label={t.labels.fileType}
          value={
            currentVersion
              ? getWorkspaceFileGermanLabel(
                  currentVersion.mimeType,
                  currentVersion.filename,
                )
              : "—"
          }
        />

        <DetailRow
          label={t.labels.fileSize}
          value={
            currentVersion
              ? formatWorkspaceFileSize(
                  currentVersion.sizeBytes,
                )
              : "—"
          }
        />

        <DetailRow
          label={t.labels.uploaded}
          value={
            currentVersion
              ? formatWorkspaceDate(currentVersion.createdAt)
              : "—"
          }
        />

        <DetailRow
          label={t.labels.modified}
          value={formatWorkspaceDate(document.updatedAt)}
        />

        <DetailRow
          label={t.labels.version}
          value={
            currentVersion
              ? `v${currentVersion.versionNumber}`
              : "—"
          }
        />
      </dl>
    </Dialog>
  );
}
