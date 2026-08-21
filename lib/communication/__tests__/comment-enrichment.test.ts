/**
 * lib/communication/__tests__/comment-enrichment.test.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findMany: mocks.userFindMany,
    },
  },
}));

import { enrichInternalComments } from "@/lib/communication/comment-enrichment";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("enrichInternalComments", () => {
  it("strips body for deleted comments", async () => {
    mocks.userFindMany.mockResolvedValue([
      {
        id: "user-a",
        firstName: "Michael",
        lastName: "Duijster",
        email: "michael@example.com",
        person: null,
      },
    ]);

    const [comment] = await enrichInternalComments("tenant-a", [
      {
        id: "comment-a",
        tenantId: "tenant-a",
        threadId: "thread-a",
        authorUserId: "user-a",
        body: "Secret body",
        deletedAt: new Date("2026-08-21T12:00:00.000Z"),
        createdAt: new Date("2026-08-21T12:00:00.000Z"),
        updatedAt: new Date("2026-08-21T12:00:00.000Z"),
        mentions: [],
      },
    ]);

    expect(comment.isDeleted).toBe(true);
    expect(comment.body).toBeNull();
    expect(comment.authorDisplayName).toBe("Michael Duijster");
  });
});
