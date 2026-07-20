"use client";

import { FolderPlus } from "lucide-react";
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
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const inputId = "create-subfolder-name";
  const errorId = "create-subfolder-name-error";

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

      setName("");
      setError(null);
      router.refresh();
    });
  }

  const canSubmit = name.trim().length > 0 && !isPending;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-2"
    >
      <input type="hidden" name="parentId" value={parentId} />

      <label htmlFor={inputId} className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {t("fieldLabel")}
        </span>
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
          className="text-xs leading-5 text-[var(--sce-danger)]"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className="fca-button-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FolderPlus className="h-4 w-4" aria-hidden="true" />
        {isPending ? t("submittingLabel") : t("submitButton")}
      </button>
    </form>
  );
}
