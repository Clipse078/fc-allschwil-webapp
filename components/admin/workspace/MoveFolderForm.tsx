"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { moveWorkspaceFolderAction } from "@/app/(admin)/dashboard/workspace/actions";
import type { WorkspaceFolderDto } from "@/lib/workspace/dto";

type MoveFolderFormProps = {
  folderId: string;
  currentParentId: string | null;
  folders: WorkspaceFolderDto[];
};

/**
 * Client-side form for moving a Workspace folder to a new parent.
 * Returns a typed action result so that conflicts and errors are shown
 * as inline messages rather than producing a Server Component digest error.
 */
export function MoveFolderForm({
  folderId,
  currentParentId,
  folders,
}: MoveFolderFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function flattenFolders(
    items: WorkspaceFolderDto[],
  ): WorkspaceFolderDto[] {
    return items.flatMap((f) => [f, ...flattenFolders(f.children)]);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = e.currentTarget;
    const parentId = (form.elements.namedItem("parentId") as HTMLSelectElement)?.value ?? "";

    setError(null);

    const formData = new FormData();
    formData.set("folderId", folderId);
    formData.set("parentId", parentId);

    startTransition(async () => {
      const result = await moveWorkspaceFolderAction(formData);

      if (!result.ok) {
        setError(result.message ?? "The folder could not be moved.");
        return;
      }

      setError(null);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-2">
      <input type="hidden" name="folderId" value={folderId} />

      <select
        name="parentId"
        defaultValue={currentParentId ?? ""}
        disabled={isPending}
        aria-label="Move folder to"
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--blue)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">Workspace root</option>

        {flattenFolders(folders)
          .filter((folder) => folder.id !== folderId)
          .map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
      </select>

      {error ? (
        <p
          role="alert"
          className="text-xs leading-5 text-[var(--sce-danger)]"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="fca-button-secondary w-full justify-center text-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Moving…" : "Move Folder"}
      </button>
    </form>
  );
}
