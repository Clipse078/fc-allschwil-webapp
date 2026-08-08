/**
 * lib/club-directory/__tests__/ops-backup-storage.test.ts
 *
 * CLUB-DIRECTORY-02C-EXEC — unit tests for the durable pre-mutation backup
 * persistence helper used by the temporary execute endpoint. `@vercel/blob`
 * is mocked — no real network access.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPut = vi.fn();

vi.mock("@vercel/blob", () => ({
  put: mockPut,
}));

const { persistConsolidationBackupSnapshot } = await import("../ops-backup-storage");

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("persistConsolidationBackupSnapshot", () => {
  it("fails closed (no throw) when BLOB_READ_WRITE_TOKEN is not configured", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;

    const result = await persistConsolidationBackupSnapshot({ some: "data" }, "backups/a.json");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
    }
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("uploads the snapshot as a private JSON blob at the given key", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-blob-token";
    mockPut.mockResolvedValue({ url: "https://blob.example/backups/a.json", pathname: "backups/a.json" });

    const snapshot = { generatedAt: "2026-08-08T00:00:00.000Z", tenants: [] };
    const result = await persistConsolidationBackupSnapshot(snapshot, "backups/a.json");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pathname).toBe("backups/a.json");
      expect(result.url).toBe("https://blob.example/backups/a.json");
    }

    expect(mockPut).toHaveBeenCalledOnce();
    const [key, body, options] = mockPut.mock.calls[0];
    expect(key).toBe("backups/a.json");
    expect(body).toBe(JSON.stringify(snapshot, null, 2));
    expect(options).toMatchObject({
      access: "private",
      contentType: "application/json",
      token: "test-blob-token",
      allowOverwrite: false,
    });
  });

  it("returns ok:false without throwing when the upload fails", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-blob-token";
    mockPut.mockRejectedValue(new Error("network failure with sensitive detail"));

    const result = await persistConsolidationBackupSnapshot({ some: "data" }, "backups/a.json");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error).not.toContain("sensitive detail");
    }
  });

  it("never includes the blob token in the returned result", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "super-secret-blob-token";
    mockPut.mockResolvedValue({ url: "https://blob.example/backups/a.json", pathname: "backups/a.json" });

    const result = await persistConsolidationBackupSnapshot({ some: "data" }, "backups/a.json");

    expect(JSON.stringify(result)).not.toContain("super-secret-blob-token");
  });
});
