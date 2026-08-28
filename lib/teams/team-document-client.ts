export class TeamDocumentClientError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "TeamDocumentClientError";
    this.code = code;
  }
}

type ApiErrorBody = {
  error?: string;
  code?: string;
};

async function readJson(response: Response): Promise<ApiErrorBody> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return {};
  }
}

function resolveUploadError(body: ApiErrorBody, status: number): TeamDocumentClientError {
  if (body.code === "STORAGE_NOT_CONFIGURED") {
    return new TeamDocumentClientError(
      "Dateispeicher ist nicht konfiguriert.",
      body.code,
    );
  }
  if (body.code === "INVALID_INPUT") {
    return new TeamDocumentClientError(
      body.error ?? "Die Datei konnte nicht hochgeladen werden.",
      body.code,
    );
  }
  return new TeamDocumentClientError(
    body.error ?? `Upload fehlgeschlagen (${status}).`,
    body.code,
  );
}

export type UploadedTeamDocument = {
  id: string;
  title: string;
};

export async function uploadTeamDocument(
  teamId: string,
  file: File,
  title?: string,
): Promise<UploadedTeamDocument> {
  const formData = new FormData();
  formData.append("file", file);
  if (title?.trim()) {
    formData.append("title", title.trim());
  }

  const response = await fetch(
    `/api/teams/${encodeURIComponent(teamId)}/documents`,
    {
      method: "POST",
      body: formData,
    },
  );

  const body = await readJson(response);
  if (!response.ok) {
    throw resolveUploadError(body, response.status);
  }

  const document = (body as { document?: UploadedTeamDocument }).document;
  if (!document?.id) {
    throw new TeamDocumentClientError("Upload-Antwort unvollständig.");
  }

  return document;
}

export async function renameTeamDocument(
  teamId: string,
  documentId: string,
  title: string,
): Promise<UploadedTeamDocument> {
  const response = await fetch(
    `/api/teams/${encodeURIComponent(teamId)}/documents/${encodeURIComponent(documentId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    },
  );

  const body = await readJson(response);
  if (!response.ok) {
    throw new TeamDocumentClientError(
      body.error ?? "Umbenennen fehlgeschlagen.",
      body.code,
    );
  }

  const document = (body as { document?: UploadedTeamDocument }).document;
  if (!document?.id) {
    throw new TeamDocumentClientError("Antwort unvollständig.");
  }

  return document;
}

export async function deleteTeamDocument(
  teamId: string,
  documentId: string,
): Promise<void> {
  const response = await fetch(
    `/api/teams/${encodeURIComponent(teamId)}/documents/${encodeURIComponent(documentId)}`,
    { method: "DELETE" },
  );

  const body = await readJson(response);
  if (!response.ok) {
    throw new TeamDocumentClientError(
      body.error ?? "Löschen fehlgeschlagen.",
      body.code,
    );
  }
}

export function getTeamDocumentDownloadPath(
  teamId: string,
  documentId: string,
): string {
  return `/api/teams/${encodeURIComponent(teamId)}/documents/${encodeURIComponent(documentId)}/download`;
}
