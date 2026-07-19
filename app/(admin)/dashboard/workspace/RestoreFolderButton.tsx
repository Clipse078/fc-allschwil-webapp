"use client";

import { useFormStatus } from "react-dom";
import { RotateCcw } from "lucide-react";
import { restoreWorkspaceFolderAction } from "@/app/(admin)/dashboard/workspace/actions";

type RestoreFolderButtonProps = {
  folderId: string;
  folderName: string;
};

function RestoreSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RotateCcw className="h-4 w-4" />
      {pending ? "Restoring..." : "Restore"}
    </button>
  );
}

export function RestoreFolderButton({
  folderId,
  folderName,
}: RestoreFolderButtonProps) {
  function confirmRestore(event: React.FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      `Restore "${folderName}" to the active Workspace tree?`,
    );

    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <form
      action={restoreWorkspaceFolderAction}
      onSubmit={confirmRestore}
    >
      <input type="hidden" name="folderId" value={folderId} />
      <RestoreSubmitButton />
    </form>
  );
}
