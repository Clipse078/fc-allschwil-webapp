"use client";

import { RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { restoreWorkspaceFolderAction } from "@/app/(admin)/dashboard/workspace/actions";

type RestoreFolderButtonProps = {
  folderId: string;
  folderName: string;
};

export function RestoreFolderButton({
  folderId,
  folderName,
}: RestoreFolderButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const confirmed = window.confirm(
      `Restore "${folderName}" to the active Workspace tree?`,
    );

    if (!confirmed) return;

    setError(null);

    const formData = new FormData();
    formData.set("folderId", folderId);

    startTransition(async () => {
      const result = await restoreWorkspaceFolderAction(formData);

      if (!result.ok) {
        setError(result.message ?? "The folder could not be restored.");
      }
    });
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" />
          {isPending ? "Restoring..." : "Restore"}
        </button>
      </form>

      {error ? (
        <p
          role="alert"
          className="mt-2 text-xs leading-5 text-[var(--sce-danger)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
