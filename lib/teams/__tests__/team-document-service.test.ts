import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  teamFindFirst: vi.fn(),
  teamDocumentFindMany: vi.fn(),
  teamDocumentFindUnique: vi.fn(),
  teamDocumentCreate: vi.fn(),
  teamDocumentUpdate: vi.fn(),
  teamDocumentDelete: vi.fn(),
  logAction: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    team: {
      findFirst: (...args: unknown[]) => mocks.teamFindFirst(...args),
    },
    teamDocument: {
      findMany: (...args: unknown[]) => mocks.teamDocumentFindMany(...args),
      findUnique: (...args: unknown[]) => mocks.teamDocumentFindUnique(...args),
      create: (...args: unknown[]) => mocks.teamDocumentCreate(...args),
      update: (...args: unknown[]) => mocks.teamDocumentUpdate(...args),
      delete: (...args: unknown[]) => mocks.teamDocumentDelete(...args),
    },
  },
}));

vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

vi.mock("@/lib/workspace/upload-types", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/workspace/upload-types")
  >();
  return {
    ...actual,
    MAX_WORKSPACE_FILE_SIZE_BYTES: 1024,
  };
});

import {
  createTeamDocument,
  deleteTeamDocument,
  downloadTeamDocument,
  getTeamDocument,
  listTeamDocuments,
  renameTeamDocument,
  TeamDocumentServiceError,
} from "@/lib/teams/team-document-service";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const TEAM_A = "team-a";
const TEAM_B = "team-b";
const DOC_ID = "doc-01";
const USER_ID = "user-a";
const TENANT_KEY = "fca";

const pdf = new TextEncoder().encode("%PDF-1.7\nattachment");

function makeDocumentRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: DOC_ID,
    tenantId: TENANT_A,
    teamId: TEAM_A,
    title: "Season Plan",
    storageKey: "team-docs/fca/team-a/doc-01/plan.pdf",
    originalFilename: "plan.pdf",
    mimeType: "application/pdf",
    sizeBytes: pdf.byteLength,
    uploadedByUserId: USER_ID,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function storage() {
  return {
    upload: vi.fn().mockImplementation(async ({ storageKey, buffer }) => ({
      storageKey,
      checksumSha256: "sha256",
      sizeBytes: buffer.byteLength,
    })),
    download: vi.fn().mockResolvedValue({
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(pdf);
          controller.close();
        },
      }),
      contentType: "application/pdf",
      sizeBytes: pdf.byteLength,
    }),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.teamFindFirst.mockResolvedValue({ id: TEAM_A, tenantId: TENANT_A });
  mocks.logAction.mockResolvedValue(undefined);
});

describe("team document domain service", () => {
  it("lists documents scoped by tenant and team", async () => {
    mocks.teamDocumentFindMany.mockResolvedValue([makeDocumentRow()]);
    const docs = await listTeamDocuments(TENANT_A, TEAM_A);
    expect(mocks.teamDocumentFindMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_A, teamId: TEAM_A },
      orderBy: { createdAt: "desc" },
      select: expect.any(Object),
    });
    expect(docs).toHaveLength(1);
    expect(docs[0]).not.toHaveProperty("storageUrl");
    expect(docs[0]).not.toHaveProperty("url");
    expect(docs[0]).not.toHaveProperty("publicUrl");
    expect(docs[0]).not.toHaveProperty("downloadUrl");
  });

  it("gets a document scoped by tenant and team", async () => {
    mocks.teamDocumentFindUnique.mockResolvedValue(makeDocumentRow());
    const doc = await getTeamDocument(TENANT_A, TEAM_A, DOC_ID);
    expect(doc?.id).toBe(DOC_ID);
  });

  it("returns null for cross-tenant document access", async () => {
    mocks.teamDocumentFindUnique.mockResolvedValue(makeDocumentRow());
    await expect(getTeamDocument(TENANT_B, TEAM_A, DOC_ID)).resolves.toBeNull();
  });

  it("returns null for cross-team document access", async () => {
    mocks.teamDocumentFindUnique.mockResolvedValue(makeDocumentRow());
    await expect(getTeamDocument(TENANT_A, TEAM_B, DOC_ID)).resolves.toBeNull();
  });

  it("rejects upload when the team does not belong to the tenant", async () => {
    mocks.teamFindFirst.mockResolvedValue(null);
    await expect(
      createTeamDocument({
        tenantId: TENANT_A,
        teamId: TEAM_A,
        actorUserId: USER_ID,
        tenantKey: TENANT_KEY,
        title: "Season Plan",
        filename: "plan.pdf",
        mimeType: "application/pdf",
        fileBuffer: pdf,
        storage: storage(),
      }),
    ).rejects.toMatchObject({ code: "TEAM_NOT_FOUND" });
  });

  it("persists metadata after a successful upload with team-docs namespace", async () => {
    const provider = storage();
    mocks.teamDocumentCreate.mockImplementation(async ({ data }) => ({
      ...makeDocumentRow(),
      ...data,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    }));

    const result = await createTeamDocument({
      tenantId: TENANT_A,
      teamId: TEAM_A,
      actorUserId: USER_ID,
      tenantKey: TENANT_KEY,
      title: "Display Title",
      filename: "../Season: Plan.pdf",
      mimeType: "application/pdf",
      fileBuffer: pdf,
      storage: provider,
    });

    expect(result.title).toBe("Display Title");
    expect(result.originalFilename).toBe("Season- Plan.pdf");
    expect(result._storageKey).toMatch(
      /^team-docs\/fca\/team-a\/[a-f0-9-]+\/Season- Plan\.pdf$/,
    );
    expect(result).not.toHaveProperty("storageUrl");
    expect(result).not.toHaveProperty("url");
    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "team_document_uploaded" }),
    );
  });

  it("does not use the display title in the storage key", async () => {
    const provider = storage();
    mocks.teamDocumentCreate.mockImplementation(async ({ data }) => ({
      ...makeDocumentRow(),
      ...data,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    }));

    const result = await createTeamDocument({
      tenantId: TENANT_A,
      teamId: TEAM_A,
      actorUserId: USER_ID,
      tenantKey: TENANT_KEY,
      title: "Completely Different Title",
      filename: "plan.pdf",
      mimeType: "application/pdf",
      fileBuffer: pdf,
      storage: provider,
    });

    expect(result._storageKey).toContain("/plan.pdf");
    expect(result._storageKey).not.toContain("Completely Different Title");
  });

  it("renames title only without changing filename or storage key", async () => {
    mocks.teamDocumentFindUnique.mockResolvedValue(makeDocumentRow());
    mocks.teamDocumentUpdate.mockImplementation(async ({ data }) =>
      makeDocumentRow({ title: data.title }),
    );

    const result = await renameTeamDocument({
      tenantId: TENANT_A,
      teamId: TEAM_A,
      documentId: DOC_ID,
      actorUserId: USER_ID,
      title: "Updated Title",
    });

    expect(result.title).toBe("Updated Title");
    expect(result.originalFilename).toBe("plan.pdf");
    expect(result._storageKey).toBe("team-docs/fca/team-a/doc-01/plan.pdf");
    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "team_document_renamed" }),
    );
  });

  it("deletes DB metadata first and attempts blob cleanup", async () => {
    const provider = storage();
    mocks.teamDocumentFindUnique.mockResolvedValue(makeDocumentRow());
    mocks.teamDocumentDelete.mockResolvedValue(undefined);

    await deleteTeamDocument({
      tenantId: TENANT_A,
      teamId: TEAM_A,
      documentId: DOC_ID,
      actorUserId: USER_ID,
      storage: provider,
    });

    expect(mocks.teamDocumentDelete).toHaveBeenCalledWith({
      where: { id: DOC_ID },
    });
    expect(provider.delete).toHaveBeenCalledWith(
      "team-docs/fca/team-a/doc-01/plan.pdf",
    );
    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "team_document_deleted" }),
    );
  });

  it("best-effort deletes the private object when metadata persistence fails", async () => {
    const provider = storage();
    mocks.teamDocumentCreate.mockRejectedValue(new Error("database unavailable"));

    await expect(
      createTeamDocument({
        tenantId: TENANT_A,
        teamId: TEAM_A,
        actorUserId: USER_ID,
        tenantKey: TENANT_KEY,
        title: "Season Plan",
        filename: "plan.pdf",
        mimeType: "application/pdf",
        fileBuffer: pdf,
        storage: provider,
      }),
    ).rejects.toMatchObject({ code: "PERSISTENCE_FAILED" });

    expect(provider.delete).toHaveBeenCalledWith(
      expect.stringMatching(/^team-docs\/fca\/team-a\//),
    );
  });

  it("rejects oversized uploads", async () => {
    const provider = storage();
    const { MAX_WORKSPACE_FILE_SIZE_BYTES } = await import(
      "@/lib/workspace/upload-types"
    );
    const oversized = new Uint8Array(MAX_WORKSPACE_FILE_SIZE_BYTES + 1);
    oversized.set(pdf);

    await expect(
      createTeamDocument({
        tenantId: TENANT_A,
        teamId: TEAM_A,
        actorUserId: USER_ID,
        tenantKey: TENANT_KEY,
        title: "Large File",
        filename: "large.pdf",
        mimeType: "application/pdf",
        fileBuffer: oversized,
        storage: provider,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(provider.upload).not.toHaveBeenCalled();
  });

  it("rejects unsafe file types", async () => {
    const provider = storage();
    await expect(
      createTeamDocument({
        tenantId: TENANT_A,
        teamId: TEAM_A,
        actorUserId: USER_ID,
        tenantKey: TENANT_KEY,
        title: "Executable",
        filename: "payload.exe",
        mimeType: "application/octet-stream",
        fileBuffer: new Uint8Array([1, 2, 3]),
        storage: provider,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(provider.upload).not.toHaveBeenCalled();
  });

  it("resolves download through private storage without public URLs", async () => {
    const provider = storage();
    mocks.teamDocumentFindUnique.mockResolvedValue(makeDocumentRow());

    const result = await downloadTeamDocument({
      tenantId: TENANT_A,
      teamId: TEAM_A,
      documentId: DOC_ID,
      storage: provider,
    });

    expect(provider.download).toHaveBeenCalledWith({
      storageKey: "team-docs/fca/team-a/doc-01/plan.pdf",
      filename: "plan.pdf",
      contentType: "application/pdf",
    });
    expect(result).not.toHaveProperty("url");
    expect(result).not.toHaveProperty("storageUrl");
  });
});
