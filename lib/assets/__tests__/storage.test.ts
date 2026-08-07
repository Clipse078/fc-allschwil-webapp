import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const putMock = vi.fn();
const delMock = vi.fn();
const fileTypeFromBufferMock = vi.fn();

vi.mock("@vercel/blob", () => ({
  put: (...args: unknown[]) => putMock(...args),
  del: (...args: unknown[]) => delMock(...args),
}));

vi.mock("file-type", () => ({
  fileTypeFromBuffer: (...args: unknown[]) => fileTypeFromBufferMock(...args),
}));

import { uploadExternalClubLogo, uploadExternalTeamLogo, uploadTenantLogo } from "../storage";

const PNG_BUFFER = new Uint8Array([1, 2, 3, 4]);

describe("CLUB-DIRECTORY-01 crest upload — shares uploadTenantLogo's validation core", () => {
  const originalToken = process.env.BLOB_READ_WRITE_TOKEN;

  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    putMock.mockReset();
    delMock.mockReset();
    fileTypeFromBufferMock.mockReset();
    fileTypeFromBufferMock.mockResolvedValue({ mime: "image/png" });
    putMock.mockResolvedValue({ url: "https://blob.example.com/uploaded.png" });
  });

  afterEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = originalToken;
  });

  it("uploadExternalClubLogo stores the crest at the club-scoped key", async () => {
    const result = await uploadExternalClubLogo("fc-allschwil", "club-1", PNG_BUFFER, "image/png");

    expect(result).toEqual({ ok: true, publicUrl: "https://blob.example.com/uploaded.png" });
    expect(putMock).toHaveBeenCalledWith(
      "clubs/fc-allschwil/club-1.png",
      expect.anything(),
      expect.objectContaining({ access: "public", contentType: "image/png" }),
    );
  });

  it("uploadExternalTeamLogo stores the crest at the team-scoped key", async () => {
    const result = await uploadExternalTeamLogo("fc-allschwil", "team-1", PNG_BUFFER, "image/png");

    expect(result).toEqual({ ok: true, publicUrl: "https://blob.example.com/uploaded.png" });
    expect(putMock).toHaveBeenCalledWith(
      "clubs/fc-allschwil/teams/team-1.png",
      expect.anything(),
      expect.objectContaining({ access: "public", contentType: "image/png" }),
    );
  });

  it("rejects a disallowed MIME type before ever calling Vercel Blob", async () => {
    const result = await uploadExternalClubLogo("fc-allschwil", "club-1", PNG_BUFFER, "image/gif");
    expect(result.ok).toBe(false);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("rejects when the magic-byte-detected type disagrees with the declared MIME type", async () => {
    fileTypeFromBufferMock.mockResolvedValue({ mime: "image/webp" });
    const result = await uploadExternalClubLogo("fc-allschwil", "club-1", PNG_BUFFER, "image/png");
    expect(result.ok).toBe(false);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("returns a clean 503 (no throw) when BLOB_READ_WRITE_TOKEN is absent", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const result = await uploadExternalTeamLogo("fc-allschwil", "team-1", PNG_BUFFER, "image/png");
    expect(result).toEqual(
      expect.objectContaining({ ok: false, status: 503 }),
    );
  });

  it("uploadTenantLogo (pre-existing behaviour) is unaffected by the shared refactor", async () => {
    const result = await uploadTenantLogo("fc-allschwil", PNG_BUFFER, "image/png");
    expect(result).toEqual({ ok: true, publicUrl: "https://blob.example.com/uploaded.png" });
    expect(putMock).toHaveBeenCalledWith(
      "logos/fc-allschwil.png",
      expect.anything(),
      expect.objectContaining({ access: "public", contentType: "image/png" }),
    );
  });
});
