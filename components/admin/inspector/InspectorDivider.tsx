"use client";

/**
 * components/admin/inspector/InspectorDivider.tsx
 *
 * Visual divider for use between inspector groups or sections.
 */

export default function InspectorDivider({ className = "" }: { className?: string }) {
  return (
    <hr className={`border-t border-[var(--border)] ${className}`} />
  );
}
