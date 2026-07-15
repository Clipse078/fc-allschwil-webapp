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
  renameWorkspaceFolderAction,
} from "@/app/(admin)/dashboard/workspace/actions";
import { hasPermission } from "@/lib/permissions/has-permission";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getWorkspaceFolderById,
  getWorkspaceFolderTree,
} from "@/lib/workspace/queries";
import type { WorkspaceFolderDto } from "@/lib/workspace/dto";
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

  const [folders, selectedFolder] = await Promise.all([
    getWorkspaceFolderTree(tenantId),
    selectedFolderId
      ? getWorkspaceFolderById(tenantId, selectedFolderId)
      : Promise.resolve(null),
  ]);

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
          <div className="border-b border-[var(--border)] px-5 py-4">
            <p className="text-xs font-medium text-[var(--text-2)]">
              {selectedFolder ? selectedFolder.name : "Workspace"}
            </p>
          </div>

          <div className="flex flex-1 items-center justify-center px-6 py-16">
            <div className="w-full max-w-md text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-2)]">
                {selectedFolder ? (
                  <FolderOpen className="h-7 w-7 text-[var(--blue)]" />
                ) : (
                  <LockKeyhole className="h-7 w-7 text-[var(--blue)]" />
                )}
              </div>

              <h2 className="mt-5 text-xl font-semibold text-[var(--text)]">
                {selectedFolder
                  ? selectedFolder.name
                  : folders.length > 0
                    ? "Select a folder"
                    : "Welcome to Workspace"}
              </h2>

              <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
                {selectedFolder
                  ? "This folder is ready for documents and subfolders."
                  : folders.length > 0
                    ? "Choose a folder from the tree to view its contents."
                    : "Create your club's first folder to begin organising internal documents."}
              </p>

              {canManage && selectedFolder ? (
                <div className="mt-6">
                  <CreateFolderForm parentId={selectedFolder.id} />
                </div>
              ) : null}

              {canManage && folders.length === 0 ? (
                <div className="mt-6">
                  <CreateFolderForm />
                </div>
              ) : null}

              {!canManage && folders.length === 0 ? (
                <p className="mt-5 text-xs text-[var(--muted)]">
                  A Workspace manager must create the first folder.
                </p>
              ) : null}
            </div>
          </div>
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
              </dl>
            ) : (
              <p className="text-sm text-[var(--text-2)]">
                No item selected.
              </p>
            )}
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
