export type WorkspaceUploadResponse = {
  document?: unknown;
  error?: string;
};

type UploadWorkspaceFileInput = {
  file: File;
  folderId: string;
};

async function readUploadResponse(
  response: Response,
): Promise<WorkspaceUploadResponse> {
  try {
    return (await response.json()) as WorkspaceUploadResponse;
  } catch {
    return {};
  }
}

export async function uploadWorkspaceFile({
  file,
  folderId,
}: UploadWorkspaceFileInput): Promise<WorkspaceUploadResponse> {
  const formData = new FormData();

  formData.append("file", file);
  formData.append("folderId", folderId);

  const response = await fetch("/api/workspace/documents", {
    method: "POST",
    body: formData,
  });

  const result = await readUploadResponse(response);

  if (!response.ok) {
    throw new Error(
      result.error ||
        `Upload failed with status ${response.status}.`,
    );
  }

  return result;
}
