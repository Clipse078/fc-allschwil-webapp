import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  uploadImmutable: vi.fn(),
  download: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/workspace/upload-storage", () => ({
  workspaceStorageProvider: mocks,
}));

import {
  getTeamDocumentStorageKey,
  WorkspaceBlobTeamDocumentStorage,
} from "@/lib/teams/team-document-storage";

describe("team document storage", () => {
  it("uses the team-docs namespace with tenantKey, teamId and documentId", () => {
    expect(
      getTeamDocumentStorageKey({
        tenantKey: "fca",
        teamId: "team-01",
        documentId: "doc-01",
        filename: "../Season Plan: Final.pdf",
      }),
    ).toBe("team-docs/fca/team-01/doc-01/Season Plan- Final.pdf");
  });

  it("does not derive keys from display titles", () => {
    const key = getTeamDocumentStorageKey({
      tenantKey: "fca",
      teamId: "team-01",
      documentId: "doc-01",
      filename: "original.pdf",
    });
    expect(key).not.toContain("Display Title");
    expect(key.endsWith("/original.pdf")).toBe(true);
  });

  it("reuses the private Workspace Blob provider without exposing URLs", async () => {
    mocks.uploadImmutable.mockResolvedValue({
      storageKey: "team-docs/fca/team-01/doc-01/file.pdf",
      checksumSha256: "sha256",
      sizeBytes: 3,
    });
    const storage = new WorkspaceBlobTeamDocumentStorage();
    const result = await storage.upload({
      storageKey: "team-docs/fca/team-01/doc-01/file.pdf",
      contentType: "application/pdf",
      buffer: new Uint8Array([1, 2, 3]),
    });
    expect(mocks.uploadImmutable).toHaveBeenCalledOnce();
    expect(result).not.toHaveProperty("url");
    expect(result).not.toHaveProperty("storageUrl");
  });
});
