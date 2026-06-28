"use client";

/**
 * components/admin/visual-builder/InlineEditableText.tsx
 *
 * Inline text editing wrapper for the Visual Canvas.
 *
 * Wraps any editable text field and enables in-place editing.
 * Double-click activates editing; blur or Enter commits the change.
 * Escape reverts to the original value.
 *
 * Initial scope (Slice 1):
 *   - eyebrow, headline (simple string fields)
 *   - hero title, hero subtitle
 *   - callToAction title
 *
 * Out of scope for Slice 1:
 *   - Rich text inline editing
 *   - Image replacement inline
 *   - Link editing inline
 *   - Array fields (card titles, etc.)
 */

import { useRef, useState, useCallback } from "react";
import { Pencil } from "lucide-react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type InlineEditableTextProps = {
  value: string;
  onCommit: (newValue: string) => void;
  /** Element type for the rendered text (default: "p") */
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span";
  /** Additional class names for the text element */
  className?: string;
  /** Placeholder shown when value is empty */
  placeholder?: string;
  /** Whether inline editing is disabled (e.g. data-driven sections) */
  disabled?: boolean;
};

// ---------------------------------------------------------------------------
// InlineEditableText
// ---------------------------------------------------------------------------

export default function InlineEditableText({
  value,
  onCommit,
  as: Tag = "p",
  className = "",
  placeholder = "Hier klicken zum Bearbeiten…",
  disabled = false,
}: InlineEditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  // draft is initialised on demand in startEditing — no effect sync needed
  const [draft, setDraft] = useState("");
  const editableRef = useRef<HTMLElement>(null);

  const startEditing = useCallback(() => {
    if (disabled) return;
    setDraft(value);
    setIsEditing(true);
  }, [disabled, value]);

  const commitEdit = useCallback(() => {
    const trimmed = (editableRef.current?.textContent ?? draft).trim();
    setIsEditing(false);
    if (trimmed !== value) {
      onCommit(trimmed);
    }
  }, [draft, value, onCommit]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setDraft(value);
    if (editableRef.current) {
      editableRef.current.textContent = value;
    }
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitEdit();
    }
    if (e.key === "Escape") {
      cancelEdit();
    }
  }

  if (disabled) {
    return (
      <Tag className={className}>
        {value || <span className="opacity-40 italic">{placeholder}</span>}
      </Tag>
    );
  }

  if (isEditing) {
    return (
      <Tag
        ref={editableRef as React.RefObject<never>}
        contentEditable
        suppressContentEditableWarning
        onBlur={commitEdit}
        onKeyDown={handleKeyDown}
        className={`outline-none ring-2 ring-blue-400 ring-offset-1 rounded cursor-text ${className}`}
        style={{ minWidth: "2rem" }}
      >
        {draft}
      </Tag>
    );
  }

  return (
    <span className="group/inline relative inline-flex items-baseline gap-1">
      <Tag
        className={`cursor-text ${className}`}
        onDoubleClick={startEditing}
        title="Doppelklick zum Bearbeiten"
      >
        {value || <span className="opacity-40 italic">{placeholder}</span>}
      </Tag>
      <button
        type="button"
        onClick={startEditing}
        title="Inline bearbeiten"
        className="opacity-0 group-hover/inline:opacity-100 transition-opacity p-0.5 rounded text-blue-500 hover:text-blue-700 hover:bg-blue-50"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </span>
  );
}
