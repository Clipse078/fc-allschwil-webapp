import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listTeamDocuments: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock("@/lib/teams/team-document-service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/teams/team-document-service")
  >();
  return {
    ...actual,
    listTeamDocuments: mocks.listTeamDocuments,
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findMany: (...args: unknown[]) => mocks.userFindMany(...args),
    },
  },
}));

import { TeamDocumentServiceError } from "@/lib/teams/team-document-service";
import {
  getTeamDocumentListItems,
  mapTeamDocumentToListItem,
  shouldShowOriginalFilename,
} from "@/lib/teams/team-document-list";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const TEAM_A = "team-a";
const TEAM_B = "team-b";
const USER_ID = "user-a";

function makeRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "doc-1",
    tenantId: TENANT_A,
    teamId: TEAM_A,
    title: "Saisonplan",
    originalFilename: "saisonplan.pdf",
    mimeType: "application/pdf",
    sizeBytes: 824 * 1024,
    uploadedByUserId: USER_ID,
    createdAt: new Date("2026-08-28T10:00:00.000Z"),
    updatedAt: new Date("2026-08-28T10:00:00.000Z"),
    _storageKey: "team-docs/tenant-a/team-a/doc-1/saisonplan.pdf",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TEAM-COCKPIT-PREMIUM-01J-B — team document list view model", () => {
  it("A. maps team A documents for team A", async () => {
    mocks.listTeamDocuments.mockResolvedValue([makeRecord()]);
    mocks.userFindMany.mockResolvedValue([
      { id: USER_ID, firstName: "Max", lastName: "Muster" },
    ]);

    const items = await getTeamDocumentListItems(TENANT_A, TEAM_A);

    expect(mocks.listTeamDocuments).toHaveBeenCalledWith(TENANT_A, TEAM_A);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("Saisonplan");
  });

  it("B. does not return team B documents when listing team A", async () => {
    mocks.listTeamDocuments.mockResolvedValue([]);
    const items = await getTeamDocumentListItems(TENANT_A, TEAM_A);
    expect(items).toEqual([]);
  });

  it("C. rejects tenant B access to tenant A team documents", async () => {
    mocks.listTeamDocuments.mockRejectedValue(
      new TeamDocumentServiceError("TEAM_NOT_FOUND", "Team nicht gefunden."),
    );

    await expect(getTeamDocumentListItems(TENANT_B, TEAM_A)).rejects.toMatchObject(
      { code: "TEAM_NOT_FOUND" },
    );
  });

  it("D. propagates wrong-tenant team route denial from listTeamDocuments", async () => {
    mocks.listTeamDocuments.mockRejectedValue(
      new TeamDocumentServiceError("TEAM_NOT_FOUND", "Team nicht gefunden."),
    );

    await expect(getTeamDocumentListItems(TENANT_A, TEAM_B)).rejects.toMatchObject(
      { code: "TEAM_NOT_FOUND" },
    );
  });

  it("maps only safe metadata and omits storage internals", () => {
    const item = mapTeamDocumentToListItem(makeRecord(), "Max Muster");

    expect(item).toEqual({
      id: "doc-1",
      title: "Saisonplan",
      originalFilename: "saisonplan.pdf",
      fileTypeLabel: "PDF",
      fileTypeCategory: "pdf",
      sizeLabel: "824 KB",
      uploadedAtLabel: expect.stringMatching(/28\.08\.2026/),
      uploadedByLabel: "Max Muster",
      showOriginalFilename: true,
    });
    expect(item).not.toHaveProperty("storageKey");
    expect(item).not.toHaveProperty("_storageKey");
    expect(item).not.toHaveProperty("tenantId");
    expect(item).not.toHaveProperty("uploadedByUserId");
  });

  it("G. shows original filename only when it differs from title", () => {
    expect(
      shouldShowOriginalFilename("Saisonplan", "saisonplan.pdf"),
    ).toBe(true);
    expect(
      shouldShowOriginalFilename("saisonplan.pdf", "saisonplan.pdf"),
    ).toBe(false);
  });

  it("K. includes uploader display name from batch lookup", async () => {
    mocks.listTeamDocuments.mockResolvedValue([makeRecord()]);
    mocks.userFindMany.mockResolvedValue([
      { id: USER_ID, firstName: "Max", lastName: "Muster" },
    ]);

    const items = await getTeamDocumentListItems(TENANT_A, TEAM_A);

    expect(mocks.userFindMany).toHaveBeenCalledTimes(1);
    expect(items[0]?.uploadedByLabel).toBe("Max Muster");
  });

  it("L. omits uploader label when user is missing", async () => {
    mocks.listTeamDocuments.mockResolvedValue([
      makeRecord({ uploadedByUserId: "missing-user" }),
    ]);
    mocks.userFindMany.mockResolvedValue([]);

    const items = await getTeamDocumentListItems(TENANT_A, TEAM_A);
    expect(items[0]?.uploadedByLabel).toBeNull();
  });

  it("M. preserves service order for multiple documents", async () => {
    mocks.listTeamDocuments.mockResolvedValue([
      makeRecord({ id: "doc-new", title: "Neu" }),
      makeRecord({ id: "doc-old", title: "Alt" }),
    ]);
    mocks.userFindMany.mockResolvedValue([]);

    const items = await getTeamDocumentListItems(TENANT_A, TEAM_A);
    expect(items.map((item) => item.id)).toEqual(["doc-new", "doc-old"]);
  });
});
