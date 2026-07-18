import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarClock,
  FileText,
  FolderClosed,
  FolderOpen,
  FolderPlus,
  LockKeyhole,
} from "lucide-react";
import {
  createChildWorkspaceFolderAction,
  createRootWorkspaceFolderAction,
  moveWorkspaceFolderAction,
  renameWorkspaceFolderAction,
} from "@/app/(admin)/dashboard/workspace/actions";
import { ArchiveFolderButton } from "@/app/(admin)/dashboard/workspace/ArchiveFolderButton";
import { RestoreFolderButton } from "@/app/(admin)/dashboard/workspace/RestoreFolderButton";
import { hasPermission } from "@/lib/permissions/has-permission";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getArchivedWorkspaceFolders,
  getWorkspaceFolderById,
  getWorkspaceFolderTree,
} from "@/lib/workspace/queries";
import type { WorkspaceFolderDto } from "@/lib/workspace/dto";
import { WorkspaceDocumentTable } from "@/components/admin/workspace/WorkspaceDocumentTable";
import { listWorkspaceDocuments } from "@/lib/workspace/document-service";
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
    <ul className={depth === 0 ? "space-y-1" : "mt-1 space-y-1"}>
      {folders.map((folder) => {
        const isSelected = folder.id === selectedFolderId;
        const FolderIcon = isSelected ? FolderOpen : FolderClosed;

        return (
          <li key={folder.id}>
            <Link
              href={`/dashboard/workspace?folder=${encodeURIComponent(folder.id)}`}
              aria-current={isSelected ? "page" : undefined}
              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition ${
                isSelected
                  ? "bg-[var(--blue)] text-white"
                  : "text-[var(--text)] hover:bg-[var(--surface-2)]"
              }`}
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
            >
              <FolderIcon
                className={`h-4 w-4 shrink-0 ${
                  isSelected ? "text-white" : "text-[var(--muted)]"
                }`}
              />
              <span className="min-w-0 truncate font-medium">
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

type CreateFolderFormProps = {
  compact?: boolean;
  parentId?: string;
};

function CreateFolderForm({
  compact = false,
  parentId,
}: CreateFolderFormProps) {
  const isChildFolder = Boolean(parentId);

  return (
    <form
      action={
        isChildFolder
          ? createChildWorkspaceFolderAction
          : createRootWorkspaceFolderAction
      }
      className={compact ? "flex items-center gap-2" : "mx-auto max-w-sm"}
    >
      {parentId ? (
        <input type="hidden" name="parentId" value={parentId} />
      ) : null}
      <label className={compact ? "sr-only" : "block text-left"}>
        {!compact ? (
          <span className="mb-2 block text-sm font-medium text-[var(--text)]">
            Folder name
          </span>
        ) : null}

        <input
          type="text"
          name="name"
          required
          maxLength={120}
          autoComplete="off"
          placeholder={isChildFolder ? "New subfolder" : "New folder"}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--blue)]"
        />
      </label>

      <button
        type="submit"
        className={
          compact
            ? "fca-button-primary shrink-0"
            : "fca-button-primary mt-3 w-full justify-center"
        }
      >
        <FolderPlus className="h-4 w-4" />
        {isChildFolder ? "Create Subfolder" : "Create Folder"}
      </button>
    </form>
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

  const canManage = hasPermission(
    session,
    PERMISSIONS.WORKSPACE_MANAGE,
  );

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
    ? await listWorkspaceDocuments({
        tenantId,
        folderId: selectedFolder.id,
      })
    : [];

  return (
    <PageShell fullWidth>
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Workspace" },
        ]}
      />

      <PageHeader
        eyebrow="Club Workspace"
        title="Workspace"
        description="Secure internal document management for your organisation."
      />

      <div className="grid min-h-[620px] gap-4 xl:grid-cols-[280px_minmax(0,1fr)_280px]">
        <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-4 py-4">
            <div className="flex items-center gap-2">
              <FolderClosed className="h-4 w-4 text-[var(--muted)]" />
              <h2 className="text-sm font-semibold text-[var(--text)]">
                Folders
              </h2>
            </div>

            {canManage && folders.length > 0 ? (
              <div className="mt-3">
                <CreateFolderForm compact />
              </div>
            ) : null}
          </div>

          <div className="px-3 py-3">
            {folders.length > 0 ? (
              <FolderTree
                folders={folders}
                selectedFolderId={selectedFolder?.id ?? null}
              />
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center px-3 py-10 text-center">
                <FolderClosed className="h-8 w-8 text-[var(--muted)]" />

                <p className="mt-3 text-sm font-medium text-[var(--text)]">
                  No folders yet
                </p>

                <p className="mt-1 text-xs text-[var(--text-2)]">
                  Your club can create its own folder structure.
                </p>
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-h-[520px] flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
            <div>
              <p className="text-xs font-medium text-[var(--text-2)]">
                {selectedFolder ? selectedFolder.name : "Workspace"}
              </p>

              {selectedFolder ? (
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {documents.length === 1
                    ? "1 document"
                    : `${documents.length} documents`}
                </p>
              ) : null}
            </div>

            {canManage && selectedFolder ? (
              <div className="min-w-52">
                <CreateFolderForm parentId={selectedFolder.id} />
              </div>
            ) : null}
          </div>

          {selectedFolder ? (
            <div className="flex-1">
              <WorkspaceDocumentTable documents={documents} />
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 py-16">
              <div className="w-full max-w-md text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-2)]">
                  <LockKeyhole className="h-7 w-7 text-[var(--blue)]" />
                </div>

                <h2 className="mt-5 text-xl font-semibold text-[var(--text)]">
                  {folders.length > 0
                    ? "Select a folder"
                    : "Welcome to Workspace"}
                </h2>

                <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
                  {folders.length > 0
                    ? "Choose a folder from the tree to view its contents."
                    : "Create your club's first folder to begin organising internal documents."}
                </p>

                {canManage && folders.length === 0 ? (
                  <div className="mt-6">
                    <CreateFolderForm />
                  </div>
                ) : null}

                {!canManage && folders.length === 0 ? (
                  <p className="mt-5 text-xs leading-5 text-[var(--muted)]">
                    A Workspace manager must create the first folder.
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[var(--muted)]" />
              <h2 className="text-sm font-semibold text-[var(--text)]">
                Details
              </h2>
            </div>
          </div>

          <div className="px-5 py-6">
            {selectedFolder ? (
              <dl className="space-y-5">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Name
                  </dt>

                  {canManage ? (
                    <dd className="mt-2">
                      <form
                        action={renameWorkspaceFolderAction}
                        className="space-y-2"
                      >
                        <input
                          type="hidden"
                          name="folderId"
                          value={selectedFolder.id}
                        />

                        <input
                          type="text"
                          name="name"
                          required
                          maxLength={120}
                          autoComplete="off"
                          defaultValue={selectedFolder.name}
                          aria-label="Folder name"
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--blue)]"
                        />

                        <button
                          type="submit"
                          className="fca-button-secondary w-full justify-center text-sm"
                        >
                          Rename Folder
                        </button>
                      </form>
                    </dd>
                  ) : (
                    <dd className="mt-1 text-sm font-medium text-[var(--text)]">
                      {selectedFolder.name}
                    </dd>
                  )}
                </div>

                {canManage ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Location
                    </dt>

                    <dd className="mt-2">
                      <form
                        action={moveWorkspaceFolderAction}
                        className="space-y-2"
                      >
                        <input
                          type="hidden"
                          name="folderId"
                          value={selectedFolder.id}
                        />

                        <select
                          name="parentId"
                          defaultValue={selectedFolder.parentId ?? ""}
                          aria-label="Move folder to"
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--blue)]"
                        >
                          <option value="">Workspace root</option>

                          {folders
                            .flatMap(function flattenFolderTree(
                              folder: WorkspaceFolderDto,
                            ): WorkspaceFolderDto[] {
                              return [
                                folder,
                                ...folder.children.flatMap(flattenFolderTree),
                              ];
                            })
                            .filter((folder) => folder.id !== selectedFolder.id)
                            .map((folder) => (
                              <option
                                key={folder.id}
                                value={folder.id}
                              >
                                {folder.name}
                              </option>
                            ))}
                        </select>

                        <button
                          type="submit"
                          className="fca-button-secondary w-full justify-center text-sm"
                        >
                          Move Folder
                        </button>
                      </form>
                    </dd>
                  </div>
                ) : null}

                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Description
                  </dt>
                  <dd className="mt-1 text-sm text-[var(--text-2)]">
                    {selectedFolder.description || "No description."}
                  </dd>
                </div>

                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Created
                  </dt>
                  <dd className="mt-1 text-sm text-[var(--text-2)]">
                    {formatDate(selectedFolder.createdAt)}
                  </dd>
                </div>

                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Updated
                  </dt>
                  <dd className="mt-1 text-sm text-[var(--text-2)]">
                    {formatDate(selectedFolder.updatedAt)}
                  </dd>
                </div>

                {canManage ? (
                  <div className="border-t border-[var(--border)] pt-5">
                    <ArchiveFolderButton
                      folderId={selectedFolder.id}
                      folderName={selectedFolder.name}
                    />
                    <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                      Folders containing active subfolders cannot be archived.
                    </p>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="text-sm text-[var(--text-2)]">
                No item selected.
              </p>
            )}
          </div>
        </aside>
      </div>

      {canManage && archivedFolders.length > 0 ? (
        <section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-sm font-semibold text-[var(--text)]">
              Archived folders
            </h2>
            <p className="mt-1 text-xs text-[var(--text-2)]">
              Restore archived folders to return them to the active tree.
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
                  <p className="mt-1 text-xs text-[var(--text-2)]">
                    Archived {formatDate(folder.archivedAt)}
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
