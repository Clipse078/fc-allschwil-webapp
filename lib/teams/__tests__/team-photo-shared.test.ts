/**
 * @vitest-environment node
 *
 * TEAM-COCKPIT-PREMIUM-01K — team photo shared logic tests.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  put: vi.fn(),
  del: vi.fn(),
  fileTypeFromBuffer: vi.fn(),
  teamUpdate: vi.fn(),
  logAction: vi.fn(),
  deleteOrphanedLogo: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({
  put: mocks.put,
  del: mocks.del,
}));

vi.mock("file-type", () => ({
  fileTypeFromBuffer: mocks.fileTypeFromBuffer,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    team: { update: mocks.teamUpdate },
  },
}));

vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

vi.mock("@/lib/assets/storage", () => ({
  deleteOrphanedLogo: mocks.deleteOrphanedLogo,
  isVercelBlobUrl: (url: string | null | undefined) =>
    Boolean(url?.includes("blob.vercel-storage.com")),
}));

import {
  validateTeamPhotoFile,
  uploadTeamPhoto,
  removeTeamPhoto,
  MAX_TEAM_PHOTO_BYTES,
} from "@/lib/teams/team-photo-shared";

const TEAM_ID = "team-1";
const TENANT_ID = "tenant-1";
const TENANT_KEY = "fca";
const TOKEN = "test-token";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.put.mockResolvedValue({
    url: "https://abc.public.blob.vercel-storage.com/team-photos/fca/team-1.jpg",
  });
  mocks.teamUpdate.mockResolvedValue({});
  mocks.logAction.mockResolvedValue(undefined);
  mocks.deleteOrphanedLogo.mockResolvedValue(undefined);
});

describe("validateTeamPhotoFile", () => {
  it("K. accepts JPEG", async () => {
    mocks.fileTypeFromBuffer.mockResolvedValueOnce({ mime: "image/jpeg" });
    const file = new File([Buffer.from("jpeg")], "photo.jpg", { type: "image/jpeg" });
    const result = await validateTeamPhotoFile(file, "photo.jpg");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ext).toBe("jpg");
  });

  it("L. accepts PNG", async () => {
    mocks.fileTypeFromBuffer.mockResolvedValueOnce({ mime: "image/png" });
    const file = new File([Buffer.from("png")], "photo.png", { type: "image/png" });
    const result = await validateTeamPhotoFile(file, "photo.png");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ext).toBe("png");
  });

  it("M. accepts WebP", async () => {
    mocks.fileTypeFromBuffer.mockResolvedValueOnce({ mime: "image/webp" });
    const file = new File([Buffer.from("webp")], "photo.webp", { type: "image/webp" });
    const result = await validateTeamPhotoFile(file, "photo.webp");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ext).toBe("webp");
  });

  it("N. rejects unsupported extension", async () => {
    const file = new File([Buffer.from("gif")], "photo.gif", { type: "image/gif" });
    const result = await validateTeamPhotoFile(file, "photo.gif");
    expect(result.ok).toBe(false);
  });

  it("O. rejects MIME mismatch", async () => {
    mocks.fileTypeFromBuffer.mockResolvedValueOnce({ mime: "image/png" });
    const file = new File([Buffer.from("png")], "photo.png", { type: "image/jpeg" });
    const result = await validateTeamPhotoFile(file, "photo.png");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/stimmt nicht/);
  });

  it("P. rejects invalid magic bytes", async () => {
    mocks.fileTypeFromBuffer.mockResolvedValueOnce(undefined);
    const file = new File([Buffer.from("bad")], "photo.jpg", { type: "image/jpeg" });
    const result = await validateTeamPhotoFile(file, "photo.jpg");
    expect(result.ok).toBe(false);
  });

  it("Q. rejects oversized image", async () => {
    const file = new File([new Uint8Array(MAX_TEAM_PHOTO_BYTES + 1)], "big.jpg", {
      type: "image/jpeg",
    });
    const result = await validateTeamPhotoFile(file, "big.jpg");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/4 MB/);
  });

  it("R. rejects empty file", async () => {
    const file = new File([], "empty.jpg", { type: "image/jpeg" });
    const result = await validateTeamPhotoFile(file, "empty.jpg");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/leer/);
  });

  it("S. rejects SVG", async () => {
    const file = new File([Buffer.from("<svg")], "photo.svg", { type: "image/svg+xml" });
    const result = await validateTeamPhotoFile(file, "photo.svg");
    expect(result.ok).toBe(false);
  });
});

describe("uploadTeamPhoto", () => {
  it("T. stores new photo", async () => {
    const result = await uploadTeamPhoto({
      teamId: TEAM_ID,
      tenantId: TENANT_ID,
      tenantKey: TENANT_KEY,
      currentPhotoUrl: null,
      buffer: Buffer.from("img"),
      mime: "image/jpeg",
      ext: "jpg",
      actorUserId: "user-1",
      token: TOKEN,
    });

    expect(result.ok).toBe(true);
    expect(mocks.put).toHaveBeenCalledWith(
      "team-photos/fca/team-1.jpg",
      expect.any(Buffer),
      expect.objectContaining({ access: "public", contentType: "image/jpeg" }),
    );
  });

  it("U. updates Team reference", async () => {
    await uploadTeamPhoto({
      teamId: TEAM_ID,
      tenantId: TENANT_ID,
      tenantKey: TENANT_KEY,
      currentPhotoUrl: null,
      buffer: Buffer.from("img"),
      mime: "image/jpeg",
      ext: "jpg",
      actorUserId: "user-1",
      token: TOKEN,
    });

    expect(mocks.teamUpdate).toHaveBeenCalledWith({
      where: { id: TEAM_ID, tenantId: TENANT_ID },
      data: { photoUrl: expect.stringContaining("team-photos") },
    });
  });

  it("V. replace stores new asset", async () => {
    const oldUrl = "https://abc.public.blob.vercel-storage.com/team-photos/fca/team-1.png";
    const result = await uploadTeamPhoto({
      teamId: TEAM_ID,
      tenantId: TENANT_ID,
      tenantKey: TENANT_KEY,
      currentPhotoUrl: oldUrl,
      buffer: Buffer.from("img"),
      mime: "image/jpeg",
      ext: "jpg",
      actorUserId: "user-1",
      token: TOKEN,
    });

    expect(result.ok).toBe(true);
    expect(mocks.put).toHaveBeenCalled();
  });

  it("W. old asset cleanup occurs best-effort", async () => {
    const oldUrl = "https://abc.public.blob.vercel-storage.com/team-photos/fca/team-1.png";
    await uploadTeamPhoto({
      teamId: TEAM_ID,
      tenantId: TENANT_ID,
      tenantKey: TENANT_KEY,
      currentPhotoUrl: oldUrl,
      buffer: Buffer.from("img"),
      mime: "image/jpeg",
      ext: "jpg",
      actorUserId: "user-1",
      token: TOKEN,
    });

    expect(mocks.deleteOrphanedLogo).toHaveBeenCalledWith(
      oldUrl,
      expect.stringContaining("team-photos"),
    );
  });

  it("Y. DB failure after upload cleans new asset best-effort", async () => {
    mocks.teamUpdate.mockRejectedValueOnce(new Error("db fail"));
    const result = await uploadTeamPhoto({
      teamId: TEAM_ID,
      tenantId: TENANT_ID,
      tenantKey: TENANT_KEY,
      currentPhotoUrl: null,
      buffer: Buffer.from("img"),
      mime: "image/jpeg",
      ext: "jpg",
      actorUserId: "user-1",
      token: TOKEN,
    });

    expect(result.ok).toBe(false);
    expect(mocks.del).toHaveBeenCalled();
  });

  it("writes team_photo_uploaded audit on first upload", async () => {
    await uploadTeamPhoto({
      teamId: TEAM_ID,
      tenantId: TENANT_ID,
      tenantKey: TENANT_KEY,
      currentPhotoUrl: null,
      buffer: Buffer.from("img"),
      mime: "image/jpeg",
      ext: "jpg",
      actorUserId: "user-1",
      token: TOKEN,
    });

    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "team_photo_uploaded" }),
    );
  });

  it("writes team_photo_replaced audit on replace", async () => {
    await uploadTeamPhoto({
      teamId: TEAM_ID,
      tenantId: TENANT_ID,
      tenantKey: TENANT_KEY,
      currentPhotoUrl: "https://abc.public.blob.vercel-storage.com/old.jpg",
      buffer: Buffer.from("img"),
      mime: "image/jpeg",
      ext: "jpg",
      actorUserId: "user-1",
      token: TOKEN,
    });

    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "team_photo_replaced" }),
    );
  });
});

describe("removeTeamPhoto", () => {
  const photoUrl = "https://abc.public.blob.vercel-storage.com/team-photos/fca/team-1.jpg";

  it("Z. clears Team reference", async () => {
    const result = await removeTeamPhoto({
      teamId: TEAM_ID,
      tenantId: TENANT_ID,
      currentPhotoUrl: photoUrl,
      actorUserId: "user-1",
      token: TOKEN,
    });

    expect(result.ok).toBe(true);
    expect(mocks.teamUpdate).toHaveBeenCalledWith({
      where: { id: TEAM_ID, tenantId: TENANT_ID },
      data: { photoUrl: null },
    });
  });

  it("AA. cleanup failure does not restore broken DB ref", async () => {
    mocks.del.mockRejectedValueOnce(new Error("blob fail"));

    const result = await removeTeamPhoto({
      teamId: TEAM_ID,
      tenantId: TENANT_ID,
      currentPhotoUrl: photoUrl,
      actorUserId: "user-1",
      token: TOKEN,
    });

    expect(result.ok).toBe(true);
    expect(mocks.teamUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { photoUrl: null } }),
    );
  });

  it("writes team_photo_removed audit", async () => {
    await removeTeamPhoto({
      teamId: TEAM_ID,
      tenantId: TENANT_ID,
      currentPhotoUrl: photoUrl,
      actorUserId: "user-1",
      token: TOKEN,
    });

    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "team_photo_removed" }),
    );
  });
});
