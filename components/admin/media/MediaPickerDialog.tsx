"use client";

/**
 * MediaPickerDialog — canonical, module-agnostic media selection dialog.
 *
 * This is the ONE media picker entry point new (and migrated) call sites
 * should use, regardless of whether they need a single asset (e.g. a Hero
 * Image) or several (e.g. Weitere Medien / additional media). The only
 * difference between those two use cases is the `selectionMode` prop —
 * everything else (search, folders, upload, pagination, previews, keyboard
 * shortcuts) is identical because both modes render the same underlying
 * SharedMediaPicker dialog.
 *
 * MediaPickerDialog intentionally contains NO module-specific logic (no
 * News/Homepage/Page-Builder awareness). It only translates a clean, stable
 * public API into the props SharedMediaPicker already understands:
 *
 *   <MediaPickerDialog
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     selectionMode="single" | "multiple"
 *     mediaTypes={["image"]}
 *     onSelect={(assets) => ...}
 *   />
 *
 * `onSelect` always receives an array — a single-element array in
 * "single" mode, and the full set of chosen assets in "multiple" mode.
 *
 * Future modules (Pages, Homepage Builder, Events, Teams, Sponsors,
 * Documents, Infoboard, Competitions, Player profiles, …) should reuse this
 * component rather than building another picker.
 */

import SharedMediaPicker from "@/components/admin/media/SharedMediaPicker";
import type { MediaAssetListItem } from "@/lib/media/types";

export type MediaPickerSelectionMode = "single" | "multiple";

/**
 * Asset kinds the picker can be restricted to. "document" is reserved for
 * future DAM support — the Media Library currently only stores IMAGE and
 * VIDEO assets, so requesting "document" today has no filtering effect.
 */
export type MediaPickerAssetType = "image" | "video" | "document";

export type MediaPickerDialogProps = {
  /** Whether the dialog is visible. */
  open: boolean;
  /** Called when the dialog should close (backdrop click, Escape, cancel, or a successful single-select). */
  onClose: () => void;
  /**
   * "single"   — clicking an asset immediately confirms the selection.
   * "multiple" — assets are toggled and confirmed via an "Übernehmen" action.
   * Defaults to "single".
   */
  selectionMode?: MediaPickerSelectionMode;
  /** Restrict the picker to specific asset kinds. Defaults to all kinds. */
  mediaTypes?: MediaPickerAssetType[];
  /** Fires with the chosen asset(s) once selection is confirmed. */
  onSelect: (assets: MediaAssetListItem[]) => void;
  /** Optional dialog title override. */
  title?: string;
};

function resolveFilterType(
  mediaTypes: MediaPickerAssetType[] | undefined,
): "IMAGE" | "VIDEO" | undefined {
  if (!mediaTypes || mediaTypes.length === 0) return undefined;
  const supported = mediaTypes.filter(
    (type): type is "image" | "video" => type === "image" || type === "video",
  );
  // Only collapse to a single-type filter when exactly one supported type
  // was requested — otherwise fall back to showing everything.
  if (supported.length !== 1) return undefined;
  return supported[0] === "image" ? "IMAGE" : "VIDEO";
}

export default function MediaPickerDialog({
  open,
  onClose,
  selectionMode = "single",
  mediaTypes,
  onSelect,
  title,
}: MediaPickerDialogProps) {
  const filterType = resolveFilterType(mediaTypes);
  const multiSelect = selectionMode === "multiple";

  return (
    <SharedMediaPicker
      open={open}
      onClose={onClose}
      onSelect={(asset: MediaAssetListItem) => onSelect([asset])}
      onSelectMultiple={multiSelect ? (assets: MediaAssetListItem[]) => onSelect(assets) : undefined}
      multiSelect={multiSelect}
      filterType={filterType}
      title={title ?? (multiSelect ? "Medien auswählen" : "Medium auswählen")}
    />
  );
}
