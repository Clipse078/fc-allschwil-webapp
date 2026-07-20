"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { moveWorkspaceFolderAction } from "@/app/(admin)/dashboard/workspace/actions";
import type { WorkspaceFolderDto } from "@/lib/workspace/dto";

type MoveFolderFormProps = {
  folderId: string;
  currentParentId: string | null;
  folders: WorkspaceFolderDto[];
};

export function MoveFolderForm({
  folderId,
  currentParentId,
  folders,
}: MoveFolderFormProps) {
  const t = useTranslations("Workspace.moveFolder");
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
    const parentId =
      (form.elements.namedItem("parentId") as HTMLSelectElement)?.value ?? "";

    setError(null);

    const formData = new FormData();
    formData.set("folderId", folderId);
    formData.set("parentId", parentId);

    startTransition(async () => {
      const result = await moveWorkspaceFolderAction(formData);

      if (!result.ok) {
        setError(result.message ?? t("errorGeneric"));
        return;
      }

      setError(null);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-2">
      <input type="hidden" name="folderId" value={folderId} />

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {t("fieldLabel")}
        </span>
        <select
          name="parentId"
          defaultValue={currentParentId ?? ""}
          disabled={isPending}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--blue)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="">{t("rootOption")}</option>

          {flattenFolders(folders)
            .filter((folder) => folder.id !== folderId)
            .map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
        </select>
      </label>

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
        {isPending ? t("submittingLabel") : t("submitButton")}
      </button>
    </form>
  );
}
