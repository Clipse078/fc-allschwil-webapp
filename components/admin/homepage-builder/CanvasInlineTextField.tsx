"use client";

/**
 * components/admin/homepage-builder/CanvasInlineTextField.tsx
 *
 * Admin-only inline text field for canvas inline editing (Slice K).
 *
 * Renders as a transparent <input> or <textarea> that inherits the visual
 * styling of the surrounding canvas text. Used by HeroRenderer and
 * CallToActionRenderer when `onFieldChange` is provided.
 *
 * RULES
 *   - Never imported by public-website paths.
 *   - Escape blurs (cancels edit) and stops propagation so the outer
 *     HomepageCanvasSection onKeyDown handler does not deselect the section.
 *   - Enter blurs (confirms) on single-line fields.
 *   - Shift+Enter is allowed for multiline fields only.
 *   - onClick/onMouseDown stop propagation to prevent accidental section
 *     drag-start and prevent the outer onSelect from firing unnecessarily.
 *   - Uses suppressHydrationWarning since this component is always client-only
 *     (rendered inside dynamic(..., { ssr: false }) loaders).
 */

import { useRef, useEffect } from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type CanvasInlineTextFieldProps = {
  /** Current text value. */
  value: string;
  /** Called on every change. */
  onChange: (value: string) => void;
  /** Tailwind / CSS class string from the block renderer's typography tokens. */
  className?: string;
  /** Displayed when value is empty. */
  placeholder?: string;
  /** Allow multiline input (renders as <textarea>). Default: false. */
  multiline?: boolean;
  /** Auto-focus on mount. Useful when activating via keyboard. */
  autoFocus?: boolean;
};

// ---------------------------------------------------------------------------
// Shared inline styles applied on top of className
// ---------------------------------------------------------------------------

const SHARED_INLINE: React.CSSProperties = {
  background: "transparent",
  border: "none",
  padding: 0,
  margin: 0,
  outline: "none",
  resize: "none",
  width: "100%",
  display: "block",
  fontFamily: "inherit",
  fontSize: "inherit",
  fontWeight: "inherit",
  lineHeight: "inherit",
  color: "inherit",
  letterSpacing: "inherit",
  textAlign: "inherit",
};

// ---------------------------------------------------------------------------
// CanvasInlineTextField
// ---------------------------------------------------------------------------

export function CanvasInlineTextField({
  value,
  onChange,
  className = "",
  placeholder = "…",
  multiline = false,
  autoFocus = false,
}: CanvasInlineTextFieldProps) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus();
      // Place cursor at end
      const len = ref.current.value.length;
      ref.current.setSelectionRange(len, len);
    }
  }, [autoFocus]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === "Escape") {
      // Blur but do NOT propagate so the outer canvas section
      // onKeyDown handler doesn't also fire (which would deselect the section).
      e.stopPropagation();
      (e.target as HTMLElement).blur();
    }
    if (!multiline && e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).blur();
    }
    // For multiline fields Shift+Enter is the native textarea newline — allow it.
  }

  function stopNav(e: React.MouseEvent | React.PointerEvent) {
    // Stop propagation so the parent section's onClick (which selects the section)
    // does not interfere with text editing interactions.
    e.stopPropagation();
  }

  const ringClass =
    "rounded-sm focus:ring-2 focus:ring-blue-400/70 focus:ring-offset-0";

  const hoverClass =
    "hover:outline-dashed hover:outline-1 hover:outline-blue-300/60 hover:rounded-sm cursor-text";

  const sharedClass = `${className} ${ringClass} ${hoverClass}`.trim();

  if (multiline) {
    return (
      <textarea
        ref={ref as React.Ref<HTMLTextAreaElement>}
        className={sharedClass}
        style={SHARED_INLINE}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onClick={stopNav}
        onMouseDown={stopNav}
        rows={3}
        suppressHydrationWarning
        aria-label={placeholder}
      />
    );
  }

  return (
    <input
      ref={ref as React.Ref<HTMLInputElement>}
      type="text"
      className={sharedClass}
      style={SHARED_INLINE}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onClick={stopNav}
      onMouseDown={stopNav}
      suppressHydrationWarning
      aria-label={placeholder}
    />
  );
}
