"use client";

import { WorkspaceUploadButton } from "@/components/admin/workspace/WorkspaceUploadButton";
import { WorkspaceUploadDropzone } from "@/components/admin/workspace/WorkspaceUploadDropzone";

type WorkspaceUploadControlsProps = {
  folderId: string;
  /**
   * When true, shows a compact upload button only (for folders with files).
   * When false, shows the full dropzone (for empty folders or custom layout).
   */
  compact?: boolean;
  /**
   * Called on successful upload with the new document's ID.
   */
  onUploadComplete?: (documentId: string | null) => void;
};

export function WorkspaceUploadControls({
  folderId,
  compact = false,
  onUploadComplete,
}: WorkspaceUploadControlsProps) {
  if (compact) {
    return (
      <WorkspaceUploadButton
        folderId={folderId}
        onUploadComplete={onUploadComplete}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <WorkspaceUploadButton
          folderId={folderId}
          onUploadComplete={onUploadComplete}
        />
      </div>

      <WorkspaceUploadDropzone
        folderId={folderId}
        expanded
        onUploadComplete={onUploadComplete}
      />
    </div>
  );
}
