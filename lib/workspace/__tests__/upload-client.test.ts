import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  WorkspaceUploadError,
  uploadWorkspaceFile,
} from "@/lib/workspace/upload-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makePdfFile(
  name = "report.pdf",
  content = "pdf-content",
): File {
  return new File([content], name, { type: "application/pdf" });
}

describe("uploadWorkspaceFile", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a multipart/form-data POST to /api/workspace/documents", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ document: {} }, 201));
    vi.stubGlobal("fetch", fetchMock);

    await uploadWorkspaceFile({
      file: makePdfFile(),
      folderId: "folder-1",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] =
      fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe("/api/workspace/documents");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("appends the file and folderId to the FormData body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ document: {} }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const file = makePdfFile("trainer-handbook.pdf");

    await uploadWorkspaceFile({
      file,
      folderId: "folder-abc",
    });

    const formData = fetchMock.mock.calls[0][1].body as FormData;

    expect(formData.get("file")).toBe(file);
    expect(formData.get("folderId")).toBe("folder-abc");
  });

  it("preserves the original file name and MIME type", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ document: {} }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const file = makePdfFile("Trainer Handbuch.pdf");

    await uploadWorkspaceFile({
      file,
      folderId: "folder-1",
    });

    const formData = fetchMock.mock.calls[0][1].body as FormData;
    const sentFile = formData.get("file") as File;

    expect(sentFile.name).toBe("Trainer Handbuch.pdf");
    expect(sentFile.type).toBe("application/pdf");
  });

  it("returns the parsed response body on success", async () => {
    const document = { id: "doc-1", name: "My Doc" };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ document }, 201)),
    );

    const result = await uploadWorkspaceFile({
      file: makePdfFile(),
      folderId: "folder-1",
    });

    expect(result.document).toEqual(document);
  });

  it("throws WorkspaceUploadError on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { error: "Die Datei konnte nicht gespeichert werden." },
          500,
        ),
      ),
    );

    await expect(
      uploadWorkspaceFile({
        file: makePdfFile(),
        folderId: "folder-1",
      }),
    ).rejects.toBeInstanceOf(WorkspaceUploadError);
  });

  it("attaches the server error code to the thrown error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: "Speicher nicht konfiguriert.",
            code: "WORKSPACE_UPLOAD_STORAGE_NOT_CONFIGURED",
          },
          503,
        ),
      ),
    );

    await expect(
      uploadWorkspaceFile({
        file: makePdfFile(),
        folderId: "folder-1",
      }),
    ).rejects.toMatchObject({
      code: "WORKSPACE_UPLOAD_STORAGE_NOT_CONFIGURED",
    });
  });

  it("includes the error message in the thrown WorkspaceUploadError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { error: "Upload fehlgeschlagen." },
          500,
        ),
      ),
    );

    await expect(
      uploadWorkspaceFile({
        file: makePdfFile(),
        folderId: "folder-1",
      }),
    ).rejects.toMatchObject({
      message: "Upload fehlgeschlagen.",
    });
  });

  it("throws with a generic status message when no error body is present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("", { status: 502 }),
      ),
    );

    await expect(
      uploadWorkspaceFile({
        file: makePdfFile(),
        folderId: "folder-1",
      }),
    ).rejects.toMatchObject({
      message: "Upload failed with status 502.",
    });
  });

  it("does not throw on a 201 Created response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ document: { id: "doc-1" } }, 201),
      ),
    );

    await expect(
      uploadWorkspaceFile({
        file: makePdfFile(),
        folderId: "folder-1",
      }),
    ).resolves.toBeTruthy();
  });
});

describe("WorkspaceUploadError", () => {
  it("is an instance of Error", () => {
    const err = new WorkspaceUploadError("test", "CODE");
    expect(err).toBeInstanceOf(Error);
  });

  it("sets name to WorkspaceUploadError", () => {
    const err = new WorkspaceUploadError("test");
    expect(err.name).toBe("WorkspaceUploadError");
  });

  it("stores the error code", () => {
    const err = new WorkspaceUploadError(
      "msg",
      "WORKSPACE_UPLOAD_STORAGE_NOT_CONFIGURED",
    );
    expect(err.code).toBe(
      "WORKSPACE_UPLOAD_STORAGE_NOT_CONFIGURED",
    );
  });

  it("stores undefined when no code is provided", () => {
    const err = new WorkspaceUploadError("msg");
    expect(err.code).toBeUndefined();
  });
});
