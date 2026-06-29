"use client";

/**
 * components/admin/cms/InlineEditableText.tsx
 *
 * Reusable inline text editing component for the WYSIWYG canvas.
 *
 * Behaviour:
 *   - Display mode: renders the value using any block-level HTML tag.
 *     Shows a subtle hover affordance (dashed ring + pencil icon).
 *   - Edit mode: renders a controlled input (single-line) or textarea (multi-line).
 *     Enter  → confirm (single-line only)
 *     Escape → cancel (restores original value)
 *     Blur   → confirm
 *   - Calls onChange on every keystroke (enables live preview).
 *   - Calls onCancel to revert when Escape is pressed.
 *
 * Accessibility:
 *   - aria-label on the display element.
 *   - role="button" + tabIndex on the display element.
 *   - Keyboard: Enter / Space activates edit mode.
 *   - Visible focus ring on both display and input elements.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { Pencil } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InlineEditableTextProps = {
  /** Current value (controlled). */
  value: string;
  /** Called on every keystroke while editing (drives live preview). */
  onChange: (value: string) => void;
  /** Called when Escape is pressed — parent should revert to snapshot. */
  onCancel?: () => void;
  /** Placeholder shown when value is empty. */
  placeholder?: string;
  /** When true, renders a <textarea> instead of <input>. */
  multiline?: boolean;
  /**
   * Tailwind class(es) applied to the rendered display tag.
   * Should include all visual font/colour/spacing classes.
   */
  className?: string;
  /**
   * Tailwind class(es) applied to the input/textarea in edit mode.
   * Falls back to `className` when omitted.
   */
  inputClassName?: string;
  /** aria-label for the display element. */
  ariaLabel?: string;
  /** HTML tag used in display mode. Defaults to "span". */
  as?: "p" | "h2" | "h3" | "h4" | "span" | "div";
  /** When true, disables editing (read-only display mode). */
  readOnly?: boolean;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InlineEditableText({
  value,
  onChange,
  onCancel,
  placeholder = "Klicken zum Bearbeiten…",
  multiline = false,
  className = "",
  inputClassName,
  ariaLabel,
  as: Tag = "span",
  readOnly = false,
}: InlineEditableTextProps) {
  const [editing, setEditing] = useState(false);
  /** Snapshot captured when edit mode opens; used for Escape cancellation. */
  const snapshotRef = useRef(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Focus & select on enter edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [editing]);

  const startEdit = useCallback(() => {
    if (readOnly) return;
    snapshotRef.current = value;
    setEditing(true);
  }, [readOnly, value]);

  const confirm = useCallback(() => {
    setEditing(false);
  }, []);

  const cancel = useCallback(() => {
    setEditing(false);
    if (snapshotRef.current !== value) {
      onChange(snapshotRef.current);
    }
    onCancel?.();
  }, [value, onChange, onCancel]);

  // ---------------------------------------------------------------------------
  // Edit mode — input / textarea
  // ---------------------------------------------------------------------------

  if (editing) {
    const effectiveInputClass =
      inputClassName ??
      `${className} outline-none ring-2 ring-blue-500 ring-offset-1 rounded bg-white/90 text-[var(--foreground)] w-full`;

    const commonProps = {
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        onChange(e.target.value),
      onBlur: confirm,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          cancel();
        }
        if (!multiline && e.key === "Enter") {
          e.preventDefault();
          confirm();
        }
      },
      className: effectiveInputClass,
      "aria-label": ariaLabel,
      placeholder,
    };

    if (multiline) {
      return (
        <textarea
          ref={inputRef as React.Ref<HTMLTextAreaElement>}
          {...commonProps}
          rows={3}
          className={`${effectiveInputClass} resize-none`}
        />
      );
    }

    return (
      <input
        ref={inputRef as React.Ref<HTMLInputElement>}
        type="text"
        {...commonProps}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Display mode — styled element with hover affordance
  // ---------------------------------------------------------------------------

  return (
    <Tag
      className={[
        className,
        "group relative cursor-text rounded",
        readOnly ? "" : "hover:ring-2 hover:ring-blue-300 hover:ring-offset-1 focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 focus:outline-none",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={startEdit}
      tabIndex={readOnly ? undefined : 0}
      role={readOnly ? undefined : "button"}
      aria-label={
        ariaLabel ? `${ariaLabel} — klicken zum Bearbeiten` : undefined
      }
      onKeyDown={(e) => {
        if (!readOnly && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          startEdit();
        }
      }}
    >
      {value || (
        <span className="italic text-gray-400">{placeholder}</span>
      )}
      {!readOnly && (
        <span
          className="pointer-events-none absolute -right-5 top-0 hidden group-hover:inline-flex items-center"
          aria-hidden="true"
        >
          <Pencil className="h-3 w-3 text-blue-400" />
        </span>
      )}
    </Tag>
  );
}
