"use client";

import { FolderPlus, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { createChildWorkspaceFolderAction } from "@/app/(admin)/dashboard/workspace/actions";

type CreateSubfolderFormProps = {
  parentId: string;
};

export function CreateSubfolderForm({ parentId }: CreateSubfolderFormProps) {
  const t = useTranslations("Workspace.createSubfolder");
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const inputId = "create-subfolder-name";
  const errorId = "create-subfolder-name-error";

  function openForm() {
    setExpanded(true);
    setName("");
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function closeForm() {
    if (isPending) return;
    setExpanded(false);
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
    formData.set("parentId", parentId);
    formData.set("name", trimmedName);

    startTransition(async () => {
      const result = await createChildWorkspaceFolderAction(formData);

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

      setExpanded(false);
      setName("");
      setError(null);
      router.refresh();
    });
  }

  const canSubmit = name.trim().length > 0 && !isPending;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={openForm}
        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)]"
      >
        <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
        {t("toggleButton")}
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-2 animate-in fade-in duration-150"
    >
      <input type="hidden" name="parentId" value={parentId} />

      <div className="flex items-center gap-1">
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          name="name"
          value={name}
          onChange={handleNameChange}
          maxLength={120}
          autoComplete="off"
          disabled={isPending}
          placeholder={t("fieldPlaceholder")}
          aria-label={t("fieldLabel")}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-xs text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-60 ${
            error
              ? "border-[var(--sce-danger)] bg-[var(--surface)] focus:border-[var(--sce-danger)]"
              : "border-[var(--border)] bg-[var(--surface)] focus:border-[var(--blue)]"
          }`}
        />
        <button
          type="button"
          onClick={closeForm}
          disabled={isPending}
          aria-label="Abbrechen"
          className="shrink-0 rounded-md p-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-2)]"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {error ? (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          className="text-[11px] leading-4 text-[var(--sce-danger)]"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--blue)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FolderPlus className="h-3 w-3" aria-hidden="true" />
        {isPending ? t("submittingLabel") : t("submitButton")}
      </button>
    </form>
  );
}
