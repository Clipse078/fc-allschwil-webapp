"use client";

import {
  Archive,
  Download,
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
import { workspaceDE } from "@/lib/workspace/workspace-i18n";

import { WorkspaceDocumentVersionHistoryDialog } from "./WorkspaceDocumentVersionHistoryDialog";

const t = workspaceDE.actions;

type WorkspaceDocumentActionsProps = {
  document: WorkspaceDocumentListItemDto;
  onSelect?: () => void;
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
          {t.comingSoon}
        </span>
      ) : null}
    </button>
  );
}

export function WorkspaceDocumentActions({
  document: workspaceDocument,
  onSelect,
}: WorkspaceDocumentActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
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

  function openVersionHistory() {
    setMenuOpen(false);
    setVersionHistoryOpen(true);
  }

  function handleToggleMenu(event: React.MouseEvent) {
    event.stopPropagation();
    setMenuOpen((current) => !current);
  }

  return (
    <>
      <div
        ref={menuContainerRef}
        className="relative inline-flex"
      >
        <button
          type="button"
          aria-label={t.menuLabel(workspaceDocument.name)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={handleToggleMenu}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)]"
        >
          <MoreHorizontal
            className="h-3.5 w-3.5"
            aria-hidden="true"
          />
        </button>

        {menuOpen ? (
          <div
            role="menu"
            aria-label={t.menuLabel(workspaceDocument.name)}
            className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg"
          >
            <ActionButton
              icon={<Download className="h-4 w-4" />}
              label={t.download}
              onClick={downloadDocument}
              disabled={!hasDownload}
            />

            <div
              className="my-1 border-t border-[var(--border)]"
              role="separator"
            />

            <ActionButton
              icon={<Pencil className="h-4 w-4" />}
              label={t.rename}
              disabled
            />

            <ActionButton
              icon={<FolderInput className="h-4 w-4" />}
              label={t.move}
              disabled
            />

            <ActionButton
              icon={<History className="h-4 w-4" />}
              label={t.versionHistory}
              onClick={openVersionHistory}
            />

            <div
              className="my-1 border-t border-[var(--border)]"
              role="separator"
            />

            <ActionButton
              icon={<Archive className="h-4 w-4" />}
              label={t.archive}
              disabled
            />
          </div>
        ) : null}
      </div>

      <WorkspaceDocumentVersionHistoryDialog
        documentId={workspaceDocument.id}
        documentName={workspaceDocument.name}
        open={versionHistoryOpen}
        onClose={() => setVersionHistoryOpen(false)}
      />
    </>
  );
}
