import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FolderClosed,
  FolderOpen,
  LockKeyhole,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CreateRootFolderDialog } from "@/components/admin/workspace/CreateRootFolderDialog";
import { CreateSubfolderForm } from "@/components/admin/workspace/CreateSubfolderForm";
import { RenameFolderForm } from "@/components/admin/workspace/RenameFolderForm";
import { MoveFolderForm } from "@/components/admin/workspace/MoveFolderForm";
import { ArchiveFolderButton } from "@/app/(admin)/dashboard/workspace/ArchiveFolderButton";
import { RestoreFolderButton } from "@/app/(admin)/dashboard/workspace/RestoreFolderButton";
import { WorkspaceClientShell } from "@/components/admin/workspace/WorkspaceClientShell";
import { hasPermission } from "@/lib/permissions/has-permission";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getArchivedWorkspaceFolders,
  getWorkspaceFolderById,
  getWorkspaceFolderTree,
} from "@/lib/workspace/queries";
import type { WorkspaceFolderDto } from "@/lib/workspace/dto";
import { listWorkspaceDocuments } from "@/lib/workspace/document-service";
import { buildWorkspaceBreadcrumbs } from "@/lib/workspace/breadcrumbs";
import {
  PageBreadcrumbs,
  PageHeader,
  PageShell,
} from "@/components/ui/page";

type WorkspacePageProps = {
  searchParams?: Promise<{
    folder?: string;
  }>;
};

type FolderTreeProps = {
  folders: WorkspaceFolderDto[];
  selectedFolderId: string | null;
  depth?: number;
};

function FolderTree({
  folders,
  selectedFolderId,
  depth = 0,
}: FolderTreeProps) {
  return (
    <ul className={depth === 0 ? "space-y-0.5" : "mt-0.5 space-y-0.5"}>
      {folders.map((folder) => {
        const isSelected = folder.id === selectedFolderId;
        const FolderIcon = isSelected ? FolderOpen : FolderClosed;

        return (
          <li key={folder.id}>
            <Link
              href={`/dashboard/workspace?folder=${encodeURIComponent(folder.id)}`}
              aria-current={isSelected ? "page" : undefined}
              title={folder.name}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                isSelected
                  ? "bg-[var(--blue)] text-white"
                  : "text-[var(--text)] hover:bg-[var(--surface-2)]"
              }`}
              style={{ paddingLeft: `${depth * 14 + 8}px` }}
            >
              <FolderIcon
                className={`h-3.5 w-3.5 shrink-0 ${
                  isSelected ? "text-white" : "text-[var(--muted)]"
                }`}
                aria-hidden="true"
              />
              <span className="min-w-0 truncate text-sm font-medium">
                {folder.name}
              </span>
            </Link>

            {folder.children.length > 0 ? (
              <FolderTree
                folders={folder.children}
                selectedFolderId={selectedFolderId}
                depth={depth + 1}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function WorkspacePage({
  searchParams,
}: WorkspacePageProps) {
  const t = await getTranslations("Workspace");

  const session = await requireAnyPermission([
    PERMISSIONS.WORKSPACE_VIEW,
    PERMISSIONS.WORKSPACE_MANAGE,
  ]);

  const tenantId = session.user?.tenantId;

  if (!tenantId) {
    notFound();
  }

  const params = (await searchParams) ?? {};
  const selectedFolderId = params.folder?.trim() || null;

  const canManage = hasPermission(session, PERMISSIONS.WORKSPACE_MANAGE);

  const [folders, selectedFolder, archivedFolders] = await Promise.all([
    getWorkspaceFolderTree(tenantId),
    selectedFolderId
      ? getWorkspaceFolderById(tenantId, selectedFolderId)
      : Promise.resolve(null),
    canManage
      ? getArchivedWorkspaceFolders(tenantId)
      : Promise.resolve([]),
  ]);

  const documents = selectedFolder
    ? await listWorkspaceDocuments({ tenantId, folderId: selectedFolder.id })
    : [];

  const folderPath = selectedFolder
    ? buildWorkspaceBreadcrumbs(folders, selectedFolder.id)
    : [];

  return (
    <PageShell fullWidth>
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: t("page.title") },
        ]}
      />

      <PageHeader
        eyebrow={t("page.eyebrow")}
        title={t("page.title")}
        description={t("page.description")}
      />

      <div className="grid min-h-[620px] gap-4 xl:grid-cols-[240px_minmax(0,1fr)_340px]">
        {/* ── Left: folder tree ─────────────────────────────── */}
        <aside className="flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-4 py-3.5">
            <div className="flex items-center gap-2">
              <FolderClosed className="h-4 w-4 text-[var(--muted)]" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-[var(--text)]">
                {t("folders.panelTitle")}
              </h2>
            </div>

            {canManage ? (
              <div className="mt-3">
                <CreateRootFolderDialog />
              </div>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2">
            {folders.length > 0 ? (
              <FolderTree
                folders={folders}
                selectedFolderId={selectedFolder?.id ?? null}
              />
            ) : (
              <div className="flex min-h-40 flex-col items-center justify-center px-3 py-8 text-center">
                <FolderClosed className="h-7 w-7 text-[var(--muted)]" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-[var(--text)]">
                  {t("folders.noFoldersTitle")}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-2)]">
                  {t("folders.noFoldersDescription")}
                </p>
              </div>
            )}
          </div>

          {canManage && selectedFolder ? (
            <div className="border-t border-[var(--border)] px-3 py-3">
              <CreateSubfolderForm parentId={selectedFolder.id} />
            </div>
          ) : null}
        </aside>

        {/* ── Centre + Right panels ─────────────────────────── */}
        {selectedFolder ? (
          <WorkspaceClientShell
            documents={documents}
            folderId={selectedFolder.id}
            folderName={selectedFolder.name}
            folderDescription={selectedFolder.description}
            folderCreatedAt={selectedFolder.createdAt}
            folderUpdatedAt={selectedFolder.updatedAt}
            folderPath={folderPath}
            canManage={canManage}
            folderManagementSlot={
              canManage ? (
                <div className="space-y-3">
                  <RenameFolderForm
                    folderId={selectedFolder.id}
                    currentName={selectedFolder.name}
                  />
                  <div className="border-t border-[var(--border)] pt-3">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {t("folderDetails.locationLabel")}
                    </p>
                    <MoveFolderForm
                      folderId={selectedFolder.id}
                      currentParentId={selectedFolder.parentId ?? null}
                      folders={folders}
                    />
                  </div>
                  <div className="border-t border-[var(--border)] pt-3">
                    <ArchiveFolderButton
                      folderId={selectedFolder.id}
                      folderName={selectedFolder.name}
                    />
                    <p className="mt-1.5 text-[11px] leading-4 text-[var(--muted)]">
                      {t("folders.cannotArchiveNote")}
                    </p>
                  </div>
                </div>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Welcome / no-selection state */}
            <section className="flex min-h-[520px] flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-16">
              <div className="w-full max-w-md text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-2)]">
                  <LockKeyhole className="h-7 w-7 text-[var(--blue)]" aria-hidden="true" />
                </div>

                <h2 className="mt-5 text-xl font-semibold text-[var(--text)]">
                  {folders.length > 0
                    ? t("folders.selectFolder")
                    : t("folders.welcomeTitle")}
                </h2>

                <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
                  {folders.length > 0
                    ? t("folders.selectFolderDescription")
                    : t("folders.welcomeDescription")}
                </p>

                {canManage && folders.length === 0 ? (
                  <div className="mt-6">
                    <CreateRootFolderDialog />
                  </div>
                ) : null}

                {!canManage && folders.length === 0 ? (
                  <p className="mt-5 text-xs leading-5 text-[var(--muted)]">
                    {t("folders.noPermissionNote")}
                  </p>
                ) : null}
              </div>
            </section>

            <aside className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="border-b border-[var(--border)] px-5 py-3.5">
                <h2 className="text-sm font-semibold text-[var(--text)]">
                  {t("folderDetails.panelTitle")}
                </h2>
              </div>
              <div className="flex flex-1 items-center justify-center px-5 py-8">
                <p className="text-sm text-[var(--text-2)]">
                  {t("folderDetails.noItemSelected")}
                </p>
              </div>
            </aside>
          </>
        )}
      </div>

      {/* ── Archived folders ────────────────────────────────── */}
      {canManage && archivedFolders.length > 0 ? (
        <section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-sm font-semibold text-[var(--text)]">
              {t("archivedFolders.sectionTitle")}
            </h2>
            <p className="mt-1 text-xs text-[var(--text-2)]">
              {t("archivedFolders.sectionDescription")}
            </p>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {archivedFolders.map((folder) => (
              <div
                key={folder.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--text)]">
                    {folder.name}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-2)]">
                    {t("archivedFolders.archivedAtLabel", {
                      date: formatDate(folder.archivedAt),
                    })}
                  </p>
                </div>

                <RestoreFolderButton
                  folderId={folder.id}
                  folderName={folder.name}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}
