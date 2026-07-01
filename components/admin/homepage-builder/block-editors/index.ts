/**
 * components/admin/homepage-builder/block-editors/index.ts
 *
 * Barrel export for the Inspector-based block editor system.
 *
 * Block Editor Registry maps section type keys to their rich editor components.
 * Unsupported types fall back to UnsupportedBlockEditor.
 */

// Shell primitives
export {
  CollapsibleSection,
  InspectorField,
  SegmentedControl,
  MediaPlaceholder,
  MediaPreparedState,
} from "./BlockEditorShell";

// Block editors
export { HeroBlockEditor } from "./HeroBlockEditor";
export { CallToActionBlockEditor } from "./CallToActionBlockEditor";
export { SplitContentCardsBlockEditor } from "./SplitContentCardsBlockEditor";
export { CustomContentBlockEditor } from "./CustomContentBlockEditor";
export { UnsupportedBlockEditor } from "./UnsupportedBlockEditor";

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

import type { ComponentType } from "react";
import { HeroBlockEditor } from "./HeroBlockEditor";
import { CallToActionBlockEditor } from "./CallToActionBlockEditor";
import { SplitContentCardsBlockEditor } from "./SplitContentCardsBlockEditor";
import { CustomContentBlockEditor } from "./CustomContentBlockEditor";

export type BlockEditorProps = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
};

/**
 * Registry mapping homepage section type keys to their Inspector block editors.
 * Types not listed here fall back to UnsupportedBlockEditor.
 */
export const BLOCK_EDITOR_REGISTRY: Partial<
  Record<string, ComponentType<BlockEditorProps>>
> = {
  hero: HeroBlockEditor,
  callToAction: CallToActionBlockEditor,
  splitContentCards: SplitContentCardsBlockEditor,
  customContentPlaceholder: CustomContentBlockEditor,
};

/**
 * Returns the block editor component for the given section type key,
 * or null if no rich editor is available for that type.
 */
export function getBlockEditor(
  type: string,
): ComponentType<BlockEditorProps> | null {
  return BLOCK_EDITOR_REGISTRY[type] ?? null;
}
