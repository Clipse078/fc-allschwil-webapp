"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { renameWorkspaceFolderAction } from "@/app/(admin)/dashboard/workspace/actions";

type RenameFolderFormProps = {
  folderId: string;
  currentName: string;
};

/**
 * Client-side form for renaming an existing Workspace folder.
 * Returns a typed action result so that duplicate name conflicts are shown as
 * inline field-level messages rather than producing a Server Component digest error.
 */
export function RenameFolderForm({
  folderId,
  currentName,
}: RenameFolderFormProps) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const inputId = "rename-folder-name";
  const errorId = "rename-folder-name-error";

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setName(e.target.value);
    if (error) setError(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName || isPending) return;

    setError(null);

    const formData = new FormData();
    formData.set("folderId", folderId);
    formData.set("name", trimmedName);

    startTransition(async () => {
      const result = await renameWorkspaceFolderAction(formData);

      if (!result.ok) {
        const message =
          result.code === "WORKSPACE_FOLDER_NAME_CONFLICT"
            ? "Folder name already exists. Choose another name."
            : result.message ?? "The folder could not be renamed.";

        setError(message);

        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 0);

        return;
      }

      setError(null);
      router.refresh();
    });
  }

  const canSubmit = name.trim().length > 0 && !isPending;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-2">
      <input type="hidden" name="folderId" value={folderId} />

      <input
        id={inputId}
        ref={inputRef}
        type="text"
        name="name"
        value={name}
        onChange={handleNameChange}
        required
        maxLength={120}
        autoComplete="off"
        disabled={isPending}
        aria-label="Folder name"
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`w-full rounded-lg border px-3 py-2 text-sm text-[var(--text)] outline-none transition disabled:cursor-not-allowed disabled:opacity-60 ${
          error
            ? "border-[var(--sce-danger)] bg-[var(--surface)] focus:border-[var(--sce-danger)]"
            : "border-[var(--border)] bg-[var(--surface)] focus:border-[var(--blue)]"
        }`}
      />

      {error ? (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          className="text-xs leading-5 text-[var(--sce-danger)]"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className="fca-button-secondary w-full justify-center text-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Renaming…" : "Rename Folder"}
      </button>
    </form>
  );
}
