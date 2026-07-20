"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import type { WorkspaceDocumentListItemDto } from "@/lib/workspace/document-dto";
import { resolveWorkspaceFileType } from "@/lib/workspace/file-type-util";

import {
  formatWorkspaceDate,
  formatWorkspaceFileSize,
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

function DetailRow({ label, value, title }: DetailRowProps) {
  return (
    <div className="grid gap-1 border-b border-[var(--border)] py-3 last:border-b-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
      <dt className="font-medium text-[var(--text-2)]">{label}</dt>
      <dd className="min-w-0 break-words text-[var(--foreground)]" title={title}>
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
  const t = useTranslations("Workspace.detailsDialog");
  const ft = useTranslations("Workspace.fileTypes");
  const currentVersion = document.currentVersion;
  const fileTypeInfo = resolveWorkspaceFileType(
    currentVersion?.mimeType ?? "application/octet-stream",
    currentVersion?.filename,
  );

  function getCategoryLabel(): string {
    switch (fileTypeInfo.category) {
      case "pdf": return ft("pdf");
      case "word": return ft("word");
      case "excel": return ft("excel");
      case "powerpoint": return ft("powerpoint");
      case "image": return ft("image");
      case "video": return ft("video");
      case "audio": return ft("audio");
      case "archive": return ft("archive");
      case "text": return ft("text");
      default: return ft("unknown");
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("dialogTitle")}
      description={document.name}
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("closeButton")}
          </Button>
          <Button
            type="button"
            onClick={onDownload}
            disabled={!currentVersion}
            iconLeft={<Download className="h-4 w-4" />}
          >
            {t("downloadButton")}
          </Button>
        </>
      }
    >
      <dl>
        <DetailRow label={t("labelName")} value={document.name} />

        {currentVersion?.filename &&
        currentVersion.filename !== document.name ? (
          <DetailRow
            label={t("labelFilename")}
            value={currentVersion.filename}
            title={currentVersion.filename}
          />
        ) : null}

        <DetailRow
          label={t("labelFileType")}
          value={currentVersion ? getCategoryLabel() : t("notAvailable")}
        />

        <DetailRow
          label={t("labelSize")}
          value={
            currentVersion
              ? formatWorkspaceFileSize(currentVersion.sizeBytes)
              : t("notAvailable")
          }
        />

        <DetailRow
          label={t("labelUploaded")}
          value={
            currentVersion
              ? formatWorkspaceDate(currentVersion.createdAt)
              : t("notAvailable")
          }
        />

        <DetailRow
          label={t("labelModified")}
          value={formatWorkspaceDate(document.updatedAt)}
        />

        <DetailRow
          label={t("labelVersion")}
          value={currentVersion ? `v${currentVersion.versionNumber}` : t("notAvailable")}
        />
      </dl>
    </Dialog>
  );
}
