"use client";

import { useRouter } from "next/navigation";

import { WorkspaceUploadButton } from "@/components/admin/workspace/WorkspaceUploadButton";
import { WorkspaceUploadDropzone } from "@/components/admin/workspace/WorkspaceUploadDropzone";

type WorkspaceUploadControlsProps = {
  folderId: string;
};

export function WorkspaceUploadControls({
  folderId,
}: WorkspaceUploadControlsProps) {
  const router = useRouter();

  function handleUploadComplete() {
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <WorkspaceUploadButton
          folderId={folderId}
          onUploadComplete={handleUploadComplete}
        />
      </div>

      <WorkspaceUploadDropzone
        folderId={folderId}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
}
