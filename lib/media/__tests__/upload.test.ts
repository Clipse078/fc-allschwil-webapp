import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  del: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({
  put: vi.fn(),
  del: mocks.del,
}));

vi.mock("file-type", () => ({
  fileTypeFromBuffer: vi.fn(),
}));

import { deleteMediaBlob } from "../upload";

const originalToken = process.env.BLOB_READ_WRITE_TOKEN;

afterEach(() => {
  if (originalToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
  else process.env.BLOB_READ_WRITE_TOKEN = originalToken;
  vi.restoreAllMocks();
  mocks.del.mockReset();
});

describe("deleteMediaBlob logging hygiene", () => {
  it("does not expose the Blob URL or provider error details", async () => {
    const blobUrl =
      "https://store.public.blob.vercel-storage.com/private/media-object.png";
    const providerSecret = "provider-secret-bearing-error";
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    mocks.del.mockRejectedValue(
      new Error(`${providerSecret}: failed deleting ${blobUrl}`),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(deleteMediaBlob(blobUrl)).resolves.toBeUndefined();

    expect(mocks.del).toHaveBeenCalledWith(blobUrl, { token: "test-token" });
    const serializedLogs = JSON.stringify(warn.mock.calls);
    expect(serializedLogs).not.toContain(blobUrl);
    expect(serializedLogs).not.toContain(providerSecret);
    expect(serializedLogs).not.toContain("test-token");
    expect(serializedLogs).toContain("deleteMediaBlob");
    expect(serializedLogs).toContain("Error");
  });
});
