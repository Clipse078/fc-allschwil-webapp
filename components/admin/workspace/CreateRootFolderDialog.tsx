"use client";

import { FolderPlus } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { createRootWorkspaceFolderAction } from "@/app/(admin)/dashboard/workspace/actions";
import { Dialog } from "@/components/ui/Dialog";

export function CreateRootFolderDialog() {
  const t = useTranslations("Workspace.createFolder");
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
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
            ? t("errorConflict")
            : result.message ?? t("errorGeneric");

        setError(message);

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
        title={t("buttonLabel")}
        aria-label={t("buttonLabel")}
        className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)]"
      >
        <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      <Dialog
        open={isOpen}
        onClose={closeDialog}
        title={t("dialogTitle")}
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={closeDialog}
              disabled={isPending}
              className="fca-button-secondary"
            >
              {t("cancelButton")}
            </button>
            <button
              type="submit"
              form="create-root-folder-form"
              disabled={!canSubmit}
              className="fca-button-primary"
            >
              {isPending ? t("submittingLabel") : t("submitButton")}
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
              {t("fieldLabel")}
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
              placeholder={t("fieldPlaceholder")}
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
