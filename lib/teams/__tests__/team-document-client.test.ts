import { describe, expect, it, vi } from "vitest";
import {
  deleteTeamDocument,
  getTeamDocumentDownloadPath,
  renameTeamDocument,
  TeamDocumentClientError,
  uploadTeamDocument,
} from "@/lib/teams/team-document-client";

describe("team-document-client", () => {
  it("uploads via multipart form data", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ document: { id: "doc-1", title: "plan.pdf" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const file = new File(["%PDF"], "plan.pdf", { type: "application/pdf" });
    const result = await uploadTeamDocument("team-a", file, "Plan");

    expect(result.id).toBe("doc-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/teams/team-a/documents",
      expect.objectContaining({ method: "POST" }),
    );
    const body = fetchMock.mock.calls[0][1]?.body as FormData;
    expect(body.get("title")).toBe("Plan");
  });

  it("maps upload errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: "Dieser Dateityp ist nicht erlaubt.",
          code: "INVALID_INPUT",
        }),
      }),
    );

    const file = new File(["x"], "bad.exe", { type: "application/octet-stream" });
    await expect(uploadTeamDocument("team-a", file)).rejects.toBeInstanceOf(
      TeamDocumentClientError,
    );
  });

  it("renames via PATCH", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ document: { id: "doc-1", title: "Neu" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await renameTeamDocument("team-a", "doc-1", "Neu");
    expect(result.title).toBe("Neu");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/teams/team-a/documents/doc-1",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("deletes via DELETE", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: "ok" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await deleteTeamDocument("team-a", "doc-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/teams/team-a/documents/doc-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("builds authenticated download path without storage key", () => {
    expect(getTeamDocumentDownloadPath("team-a", "doc-1")).toBe(
      "/api/teams/team-a/documents/doc-1/download",
    );
    expect(getTeamDocumentDownloadPath("team-a", "doc-1")).not.toContain("team-docs/");
  });
});
