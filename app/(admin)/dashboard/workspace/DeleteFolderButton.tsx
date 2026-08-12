"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Dialog } from "@/components/ui/Dialog";
import {
  deleteWorkspaceFolderPermanentlyAction,
  getWorkspaceFolderDeletionImpactAction,
  type FolderDeletionImpactData,
} from "@/app/(admin)/dashboard/workspace/actions";

type DeleteFolderButtonProps = {
  folderId: string;
  folderName: string;
};

export function DeleteFolderButton({
  folderId,
  folderName,
}: DeleteFolderButtonProps) {
  const t = useTranslations("Workspace.deleteFolder");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [impact, setImpact] = useState<FolderDeletionImpactData | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleOpenDialog() {
    setDialogOpen(true);
    setImpact(null);
    setError(null);
    setLoadingImpact(true);

    const formData = new FormData();
    formData.set("folderId", folderId);

    getWorkspaceFolderDeletionImpactAction(formData).then((result) => {
      setLoadingImpact(false);
      if (result.ok) {
        setImpact(result.data);
      }
    });
  }

  function handleClose() {
    if (isPending) return;
    setDialogOpen(false);
  }

  function handleConfirm() {
    setError(null);

    const formData = new FormData();
    formData.set("folderId", folderId);

    startTransition(async () => {
      const result = await deleteWorkspaceFolderPermanentlyAction(formData);

      if (result.ok) {
        setDialogOpen(false);
      } else {
        setError(result.message ?? t("errorGeneric"));
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpenDialog}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        {t("buttonLabel")}
      </button>

      <Dialog
        open={dialogOpen}
        onClose={handleClose}
        title={t("dialogTitle")}
        description={t("dialogDescription")}
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={handleClose}
              disabled={isPending}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("cancelButton")}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending || loadingImpact}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? t("deletingLabel") : t("confirmButton")}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="font-medium text-[var(--foreground)]">
            {t("warningMessage", { name: folderName })}
          </p>

          {loadingImpact ? (
            <p className="text-xs text-[var(--muted)]">{t("loadingImpact")}</p>
          ) : impact ? (
            <ul className="space-y-1 text-xs text-[var(--text-2)]">
              {impact.descendantFolderCount > 0 ? (
                <li>
                  {impact.descendantFolderCount === 1
                    ? t("impactSubfoldersSingular")
                    : t("impactSubfoldersPlural", {
                        count: impact.descendantFolderCount,
                      })}
                </li>
              ) : null}
              {impact.documentCount > 0 ? (
                <li>
                  {impact.documentCount === 1
                    ? t("impactDocumentsSingular")
                    : t("impactDocumentsPlural", {
                        count: impact.documentCount,
                      })}
                </li>
              ) : null}
            </ul>
          ) : null}

          {error ? (
            <p role="alert" className="text-xs text-[var(--sce-danger)]">
              {error}
            </p>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
