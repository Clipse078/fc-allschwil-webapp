"use client";

/**
 * components/admin/homepage-builder/block-editors/SplitContentCardsBlockEditor.tsx
 *
 * Inspector-based rich editor for the `splitContentCards` section type.
 *
 * Delegates to the existing SplitContentCardsConfigForm (page-builder/block-forms)
 * which already provides a premium editing experience including rich text,
 * card management with drag-and-drop, and LayoutConfigPanel integration.
 *
 * This wrapper makes the form available inside the Inspector panel without
 * duplicating any editing logic.
 */

import dynamic from "next/dynamic";

// ---------------------------------------------------------------------------
// Dynamic import — avoids SSR hydration issues with TipTap
// ---------------------------------------------------------------------------

const SplitContentCardsConfigForm = dynamic(
  () =>
    import(
      "@/components/admin/page-builder/block-forms/SplitContentCardsConfigForm"
    ),
  {
    ssr: false,
    loading: () => (
      <div className="mx-4 my-3 h-32 animate-pulse rounded-lg bg-[var(--surface-2)]" />
    ),
  },
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
};

// ---------------------------------------------------------------------------
// SplitContentCardsBlockEditor
// ---------------------------------------------------------------------------

export function SplitContentCardsBlockEditor({ config, onChange }: Props) {
  return <SplitContentCardsConfigForm config={config} onChange={onChange} />;
}
