"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

import {
  formatWorkspaceDate,
  formatWorkspaceFileSize,
} from "./workspace-document-formatters";

type WorkspaceDocumentVersionHistoryItem = {
  id: string;
  versionNumber: number;
  createdAt: string;
  createdByUserId: string | null;
  createdByName: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string | null;
  status: string;
  isCurrent: boolean;
};

type WorkspaceDocumentVersionHistoryResponse = {
  versions?: WorkspaceDocumentVersionHistoryItem[];
  error?: string;
};

type WorkspaceDocumentVersionHistoryDialogProps = {
  documentId: string;
  documentName: string;
  open: boolean;
  onClose: () => void;
};

export function WorkspaceDocumentVersionHistoryDialog({
  documentId,
  documentName,
  open,
  onClose,
}: WorkspaceDocumentVersionHistoryDialogProps) {
  const t = useTranslations("Workspace.versionHistory");
  const [versions, setVersions] = useState<
    WorkspaceDocumentVersionHistoryItem[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const loadVersions = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/workspace/documents/${encodeURIComponent(documentId)}/versions`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
        },
      );

      const data = (await response.json().catch(() => null)) as
        | WorkspaceDocumentVersionHistoryResponse
        | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Versionsverlauf konnte nicht geladen werden.");
      }

      if (requestIdRef.current !== requestId) return;

      setVersions(
        Array.isArray(data?.versions) ? data.versions : [],
      );
    } catch (caughtError) {
      if (requestIdRef.current !== requestId) return;

      setVersions([]);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Versionsverlauf konnte nicht geladen werden.",
      );
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
    // t is intentionally excluded — next-intl guarantees stable references
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  useEffect(() => {
    if (!open) {
      requestIdRef.current += 1;
      setLoading(false);
      setError(null);
      setVersions([]);
      return;
    }

    void loadVersions();

    return () => {
      requestIdRef.current += 1;
    };
  }, [loadVersions, open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("dialogTitle")}
      description={documentName}
      size="lg"
      footer={
        <Button type="button" variant="secondary" onClick={onClose}>
          {t("closeButton")}
        </Button>
      }
    >
      <div aria-live="polite">
        {loading ? (
          <div
            className="flex min-h-40 items-center justify-center"
            role="status"
            aria-label={t("loadingAriaLabel")}
          >
            <Loader2
              className="h-6 w-6 animate-spin text-[var(--sce-primary)]"
              aria-hidden="true"
            />
          </div>
        ) : null}

        {!loading && error ? (
          <div
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                className="mt-0.5 h-5 w-5 shrink-0"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t("loadingError")}</p>
                <p className="mt-1 text-sm">{error}</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => void loadVersions()}
                >
                  {t("retryButton")}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {!loading && !error && versions.length === 0 ? (
          <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-center text-[var(--muted)]">
            {t("noVersions")}
          </div>
        ) : null}

        {!loading && !error && versions.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="bg-[var(--surface-2)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("versionHeader")}</th>
                  <th className="px-4 py-3 font-medium">{t("createdHeader")}</th>
                  <th className="px-4 py-3 font-medium">{t("createdByHeader")}</th>
                  <th className="px-4 py-3 font-medium">{t("filenameHeader")}</th>
                  <th className="px-4 py-3 font-medium">{t("sizeHeader")}</th>
                  <th className="px-4 py-3 font-medium">{t("statusHeader")}</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr
                    key={version.id}
                    className="border-t border-[var(--border)]"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-[var(--foreground)]">
                      v{version.versionNumber}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatWorkspaceDate(version.createdAt)}
                    </td>
                    <td className="max-w-48 truncate px-4 py-3">
                      {version.createdByName ??
                        version.createdByUserId ??
                        t("unknownUser")}
                    </td>
                    <td
                      className="max-w-72 truncate px-4 py-3 text-[var(--foreground)]"
                      title={version.filename}
                    >
                      {version.filename}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatWorkspaceFileSize(version.sizeBytes)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {version.isCurrent ? (
                        <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                          {t("statusCurrent")}
                        </span>
                      ) : (
                        <span className="text-[var(--text-2)]">
                          {version.status === "SUPERSEDED"
                            ? t("statusSuperseded")
                            : version.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
