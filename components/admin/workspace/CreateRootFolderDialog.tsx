"use client";

import { FolderPlus } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import { createRootWorkspaceFolderAction } from "@/app/(admin)/dashboard/workspace/actions";
import { Dialog } from "@/components/ui/Dialog";

type CreateRootFolderDialogProps = {
  /** Label for the trigger button. */
  buttonLabel?: string;
};

/**
 * Trigger button + accessible dialog for creating a root-level Workspace folder.
 *
 * Returns typed action results so that validation failures — including duplicate
 * name conflicts — are shown as calm, field-level inline messages without closing
 * the dialog or rendering a production digest error.
 */
export function CreateRootFolderDialog({
  buttonLabel = "Create Folder",
}: CreateRootFolderDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    // Wait for the Dialog primitive's rAF focus to complete before moving
    // focus into the input so both accessibility targets are satisfied.
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  function openDialog() {
    setName("");
    setError(null);
    setIsOpen(true);
  }

  function closeDialog() {
    if (isPending) return;
    setIsOpen(false);
    setName("");
    setError(null);
  }

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
    formData.set("name", trimmedName);

    startTransition(async () => {
      const result = await createRootWorkspaceFolderAction(formData);

      if (!result.ok) {
        const message =
          result.code === "WORKSPACE_FOLDER_NAME_CONFLICT"
            ? "Folder name already exists. Choose another name."
            : result.message ?? "The folder could not be created.";

        setError(message);

        // Return focus to input and select the text so the user can
        // replace it immediately without extra clicks.
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 0);

        return;
      }

      setIsOpen(false);
      setName("");
      router.push(
        `/dashboard/workspace?folder=${encodeURIComponent(result.data.id)}`,
      );
    });
  }

  const canSubmit = name.trim().length > 0 && !isPending;
  const inputId = "create-root-folder-name";
  const errorId = "create-root-folder-name-error";

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="fca-button-primary shrink-0"
      >
        <FolderPlus className="h-4 w-4" />
        {buttonLabel}
      </button>

      <Dialog
        open={isOpen}
        onClose={closeDialog}
        title="Create folder"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={closeDialog}
              disabled={isPending}
              className="fca-button-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-root-folder-form"
              disabled={!canSubmit}
              className="fca-button-primary"
            >
              {isPending ? "Creating…" : "Create"}
            </button>
          </>
        }
      >
        <form
          id="create-root-folder-form"
          onSubmit={handleSubmit}
          noValidate
        >
          <label htmlFor={inputId} className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Folder name
            </span>
            <input
              id={inputId}
              ref={inputRef}
              type="text"
              value={name}
              onChange={handleNameChange}
              maxLength={120}
              autoComplete="off"
              disabled={isPending}
              placeholder="e.g. Finance Documents"
              aria-invalid={error ? "true" : undefined}
              aria-describedby={error ? errorId : undefined}
              className={`w-full rounded-lg border px-3 py-2 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-60 ${
                error
                  ? "border-[var(--sce-danger)] bg-[var(--surface)] focus:border-[var(--sce-danger)]"
                  : "border-[var(--border)] bg-[var(--surface)] focus:border-[var(--blue)]"
              }`}
            />
          </label>

          {error ? (
            <p
              id={errorId}
              role="alert"
              aria-live="polite"
              className="mt-2 text-xs leading-5 text-[var(--sce-danger)]"
            >
              {error}
            </p>
          ) : null}
        </form>
      </Dialog>
    </>
  );
}
