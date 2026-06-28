"use client";

/**
 * components/admin/visual-builder/InlineEditableText.tsx
 *
 * CMS V3 — Inline Editing primitive.
 *
 * Renders text with subtle editing affordances when hovered.
 * Clicking enters edit mode (input or textarea). Blur / Enter
 * confirms the change; Escape cancels. Changes bubble up via
 * `onChange`. The parent is responsible for persisting via the
 * existing autosave / save endpoint flow.
 *
 * Usage:
 *   <InlineEditableText
 *     value={cfg.eyebrow ?? ""}
 *     onChange={(v) => update({ eyebrow: v })}
 *     placeholder="Eyebrow bearbeiten"
 *     className="text-xs font-semibold uppercase tracking-widest"
 *   />
 */

import { useState, useRef, useEffect } from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type InlineEditableTextProps = {
  /** Current text value. */
  value: string;
  /** Called with new value after blur / Enter. Not called on Escape. */
  onChange: (value: string) => void;
  /** Displayed when value is empty. */
  placeholder?: string;
  /** Allow newlines (renders <textarea>). Single-line by default. */
  multiline?: boolean;
  /** CSS classes applied to the display element and the input. */
  className?: string;
  /** Optional separate CSS override for the live input element. */
  inputClassName?: string;
  /** Hard character cap. Enforced on the input element. */
  maxLength?: number;
  /** Prevents editing. Affordances are hidden. */
  disabled?: boolean;
  /** Accessible label (e.g. "Überschrift bearbeiten"). */
  ariaLabel?: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InlineEditableText({
  value,
  onChange,
  placeholder = "Klicken zum Bearbeiten",
  multiline = false,
  className = "",
  inputClassName,
  maxLength,
  disabled = false,
  ariaLabel,
}: InlineEditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus when entering edit mode
  useEffect(() => {
    if (editing) {
      const el = multiline ? textareaRef.current : inputRef.current;
      if (el) {
        el.focus();
        if (el instanceof HTMLInputElement) el.select();
        else if (el instanceof HTMLTextAreaElement) {
          el.setSelectionRange(el.value.length, el.value.length);
        }
      }
    }
  }, [editing, multiline]);

  function startEdit() {
    if (disabled) return;
    setDraft(value);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== value) {
      onChange(trimmed);
    }
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    } else if (!multiline && e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  }

  // ---------------------------------------------------------------------------
  // Edit mode: input / textarea
  // ---------------------------------------------------------------------------

  const sharedInputClass = [
    "w-full bg-white/90 border-0 border-b-2 border-blue-500",
    "rounded-sm outline-none focus:border-blue-600 focus:ring-0",
    "text-inherit font-inherit leading-inherit",
    className,
    inputClassName ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (editing) {
    if (multiline) {
      return (
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className={`${sharedInputClass} resize-none min-h-[4rem] p-1`}
          maxLength={maxLength}
          aria-label={ariaLabel}
          rows={3}
        />
      );
    }

    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className={`${sharedInputClass} px-1 py-0.5`}
        maxLength={maxLength}
        aria-label={ariaLabel}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Display mode: styled span with affordances
  // ---------------------------------------------------------------------------

  const displayClasses = [
    className,
    !disabled
      ? [
          "cursor-text rounded-sm transition-colors duration-100",
          "hover:bg-blue-50 hover:outline hover:outline-1 hover:outline-blue-300",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500",
        ].join(" ")
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      onClick={startEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          startEdit();
        }
      }}
      tabIndex={disabled ? -1 : 0}
      role={disabled ? undefined : "button"}
      aria-label={ariaLabel ?? `${value || placeholder} bearbeiten`}
      className={displayClasses}
    >
      {value || (
        <span className="italic text-gray-400 font-normal">{placeholder}</span>
      )}
    </span>
  );
}
