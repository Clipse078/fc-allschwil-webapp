/**
 * Structured upload error that carries the server-side error code for
 * reliable client-side message mapping.
 */
export class WorkspaceUploadError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "WorkspaceUploadError";
    this.code = code;
  }
}

export type WorkspaceUploadedDocumentInfo = {
  id: string;
  name: string;
};

export type WorkspaceUploadResponse = {
  document?: WorkspaceUploadedDocumentInfo;
  error?: string;
  code?: string;
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
    throw new WorkspaceUploadError(
      result.error ||
        `Upload failed with status ${response.status}.`,
      result.code,
    );
  }

  return result;
}
