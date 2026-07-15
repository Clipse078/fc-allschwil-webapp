import { notFound } from "next/navigation";
import {
  FileText,
  FolderClosed,
  FolderPlus,
  LockKeyhole,
} from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getWorkspaceFolderTree } from "@/lib/workspace/queries";
import type { WorkspaceFolderDto } from "@/lib/workspace/dto";
import {
  PageBreadcrumbs,
  PageHeader,
  PageShell,
} from "@/components/ui/page";

type FolderTreeProps = {
  folders: WorkspaceFolderDto[];
  depth?: number;
};

function FolderTree({ folders, depth = 0 }: FolderTreeProps) {
  return (
    <ul className={depth === 0 ? "space-y-1" : "mt-1 space-y-1"}>
      {folders.map((folder) => (
        <li key={folder.id}>
          <div
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-[var(--text)]"
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            <FolderClosed className="h-4 w-4 shrink-0 text-[var(--muted)]" />
            <span className="min-w-0 truncate font-medium">{folder.name}</span>
          </div>

          {folder.children.length > 0 ? (
            <FolderTree folders={folder.children} depth={depth + 1} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default async function WorkspacePage() {
  const session = await requireAnyPermission([
    PERMISSIONS.WORKSPACE_VIEW,
    PERMISSIONS.WORKSPACE_MANAGE,
  ]);

  const tenantId = session.user?.tenantId;

  if (!tenantId) {
    notFound();
  }

  const folders = await getWorkspaceFolderTree(tenantId);

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

      <div className="grid min-h-[620px] gap-4 xl:grid-cols-[260px_minmax(0,1fr)_280px]">
        <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <div className="flex items-center gap-2">
              <FolderClosed className="h-4 w-4 text-[var(--muted)]" />
              <h2 className="text-sm font-semibold text-[var(--text)]">
                Folders
              </h2>
            </div>
          </div>

          <div className="px-3 py-3">
            {folders.length > 0 ? (
              <FolderTree folders={folders} />
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
              Workspace
            </p>
          </div>

          <div className="flex flex-1 items-center justify-center px-6 py-16">
            <div className="max-w-md text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-2)]">
                <LockKeyhole className="h-7 w-7 text-[var(--blue)]" />
              </div>

              <h2 className="mt-5 text-xl font-semibold text-[var(--text)]">
                Welcome to Workspace
              </h2>

              <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
                Store, organise and securely manage your club&apos;s internal
                documents.
              </p>

              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  disabled
                  className="fca-button-primary cursor-not-allowed opacity-50"
                >
                  <FolderPlus className="h-4 w-4" />
                  Create Folder
                </button>
              </div>

              <span className="mt-3 inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Coming soon
              </span>
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

          <div className="px-5 py-8">
            <p className="text-sm text-[var(--text-2)]">
              No item selected.
            </p>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
