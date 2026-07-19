"use client";

import {
  Archive,
  Download,
  Eye,
  FolderInput,
  History,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { WorkspaceDocumentListItemDto } from "@/lib/workspace/document-dto";

import { WorkspaceDocumentDetailsDialog } from "./WorkspaceDocumentDetailsDialog";
import { WorkspaceDocumentVersionHistoryDialog } from "./WorkspaceDocumentVersionHistoryDialog";

type WorkspaceDocumentActionsProps = {
  document: WorkspaceDocumentListItemDto;
};

type ActionButtonProps = {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
};

function ActionButton({
  icon,
  label,
  onClick,
  disabled = false,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center"
        aria-hidden="true"
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        {label}
      </span>

      {disabled ? (
        <span className="whitespace-nowrap text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
          Coming soon
        </span>
      ) : null}
    </button>
  );
}

export function WorkspaceDocumentActions({
  document: workspaceDocument,
}: WorkspaceDocumentActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] =
    useState(false);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  const hasDownload = Boolean(workspaceDocument.currentVersion);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(
          event.target as Node,
        )
      ) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    globalThis.document.addEventListener(
      "mousedown",
      handlePointerDown,
    );
    globalThis.document.addEventListener("keydown", handleKeyDown);

    return () => {
      globalThis.document.removeEventListener(
        "mousedown",
        handlePointerDown,
      );
      globalThis.document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [menuOpen]);

  function downloadDocument() {
    if (!hasDownload) {
      return;
    }

    setMenuOpen(false);

    window.location.assign(
      `/api/workspace/documents/${encodeURIComponent(
        workspaceDocument.id,
      )}/download`,
    );
  }

  function openDetails() {
    setMenuOpen(false);
    setDetailsOpen(true);
  }

  function openVersionHistory() {
    setMenuOpen(false);
    setVersionHistoryOpen(true);
  }

  return (
    <>
      <div
        ref={menuContainerRef}
        className="relative inline-flex"
      >
        <button
          type="button"
          aria-label={`Actions for ${workspaceDocument.name}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((current) => !current)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)]"
        >
          <MoreHorizontal
            className="h-4 w-4"
            aria-hidden="true"
          />
        </button>

        {menuOpen ? (
          <div
            role="menu"
            aria-label={`Actions for ${workspaceDocument.name}`}
            className="absolute right-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg"
          >
            <ActionButton
              icon={<Eye className="h-4 w-4" />}
              label="View details"
              onClick={openDetails}
            />

            <ActionButton
              icon={<Download className="h-4 w-4" />}
              label="Download"
              onClick={downloadDocument}
              disabled={!hasDownload}
            />

            <div
              className="my-1 border-t border-[var(--border)]"
              role="separator"
            />

            <ActionButton
              icon={<Pencil className="h-4 w-4" />}
              label="Rename"
              disabled
            />

            <ActionButton
              icon={<FolderInput className="h-4 w-4" />}
              label="Move"
              disabled
            />

            <ActionButton
              icon={<History className="h-4 w-4" />}
              label="Version history"
              onClick={openVersionHistory}
            />

            <ActionButton
              icon={<Archive className="h-4 w-4" />}
              label="Archive"
              disabled
            />
          </div>
        ) : null}
      </div>

      <WorkspaceDocumentDetailsDialog
        document={workspaceDocument}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        onDownload={downloadDocument}
      />

      <WorkspaceDocumentVersionHistoryDialog
        documentId={workspaceDocument.id}
        documentName={workspaceDocument.name}
        open={versionHistoryOpen}
        onClose={() => setVersionHistoryOpen(false)}
      />
    </>
  );
}