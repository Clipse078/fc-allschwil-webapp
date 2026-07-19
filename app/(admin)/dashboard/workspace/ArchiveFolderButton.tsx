"use client";

import { useFormStatus } from "react-dom";
import { Archive } from "lucide-react";
import { archiveWorkspaceFolderAction } from "@/app/(admin)/dashboard/workspace/actions";

type ArchiveFolderButtonProps = {
  folderId: string;
  folderName: string;
};

function ArchiveSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Archive className="h-4 w-4" />
      {pending ? "Archiving..." : "Archive Folder"}
    </button>
  );
}

export function ArchiveFolderButton({
  folderId,
  folderName,
}: ArchiveFolderButtonProps) {
  function confirmArchive(event: React.FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      `Archive "${folderName}"? This folder will disappear from the active Workspace tree.`,
    );

    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <form
      action={archiveWorkspaceFolderAction}
      onSubmit={confirmArchive}
    >
      <input type="hidden" name="folderId" value={folderId} />
      <ArchiveSubmitButton />
    </form>
  );
}
