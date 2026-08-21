/**
 * lib/communication/__tests__/tenant-isolation.test.ts
 *
 * COMM-01A/01B: Mandatory cross-tenant isolation test matrix (A–O).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  communicationThreadFindFirst: vi.fn(),
  communicationThreadCreate: vi.fn(),
  communicationMessageFindMany: vi.fn(),
  communicationMessageFindFirst: vi.fn(),
  communicationMessageCreate: vi.fn(),
  internalCommentFindMany: vi.fn(),
  internalCommentFindFirst: vi.fn(),
  internalCommentCreate: vi.fn(),
  internalCommentUpdate: vi.fn(),
  commentMentionCreateMany: vi.fn(),
  commentMentionDeleteMany: vi.fn(),
  registrationFindFirst: vi.fn(),
  waitingListEntryFindFirst: vi.fn(),
  tenantMembershipFindFirst: vi.fn(),
  tenantMembershipFindMany: vi.fn(),
  transaction: vi.fn(),
  logAction: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    communicationThread: {
      findFirst: mocks.communicationThreadFindFirst,
      create: mocks.communicationThreadCreate,
    },
    communicationMessage: {
      findMany: mocks.communicationMessageFindMany,
      findFirst: mocks.communicationMessageFindFirst,
      create: mocks.communicationMessageCreate,
    },
    internalComment: {
      findMany: mocks.internalCommentFindMany,
      findFirst: mocks.internalCommentFindFirst,
      create: mocks.internalCommentCreate,
      update: mocks.internalCommentUpdate,
    },
    commentMention: {
      createMany: mocks.commentMentionCreateMany,
      deleteMany: mocks.commentMentionDeleteMany,
    },
    registration: {
      findFirst: mocks.registrationFindFirst,
    },
    waitingListEntry: {
      findFirst: mocks.waitingListEntryFindFirst,
    },
    tenantMembership: {
      findFirst: mocks.tenantMembershipFindFirst,
      findMany: mocks.tenantMembershipFindMany,
    },
    user: {
      findMany: mocks.userFindMany,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/tenants/require-tenant", () => ({
  requireTenant: vi.fn().mockResolvedValue({ id: "tenant-a", key: "fc-a" }),
}));

vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

import { resolveCommunicationTargetForTenant } from "@/lib/communication/target-resolver";
import {
  getCommunicationThreadByIdForTenant,
  getOrCreateCommunicationThreadForTarget,
} from "@/lib/communication/thread-service";
import {
  createCommunicationMessage,
  getCommunicationMessageByProviderIdForTenant,
  listCommunicationMessages,
} from "@/lib/communication/message-service";
import {
  createInternalComment,
  listInternalComments,
  softDeleteInternalComment,
  updateInternalComment,
} from "@/lib/communication/comment-service";
import { listMentionCandidatesForTenant } from "@/lib/communication/mention-candidates";
import { CommunicationServiceError } from "@/lib/communication/errors";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const THREAD_A = "thread-a";
const THREAD_B = "thread-b";
const COMMENT_A = "comment-a";
const COMMENT_B = "comment-b";
const MESSAGE_B = "message-b";
const REG_A = "reg-a";
const REG_B = "reg-b";
const WAIT_B = "wait-b";
const USER_A = "user-a";
const USER_B = "user-b";

function makeThread(overrides: Record<string, unknown> = {}) {
  return {
    id: THREAD_B,
    tenantId: TENANT_B,
    targetType: "REGISTRATION",
    targetId: REG_B,
    inboundReplyToken: "token-b",
    createdByUserId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeComment(overrides: Record<string, unknown> = {}) {
  return {
    id: COMMENT_B,
    tenantId: TENANT_B,
    threadId: THREAD_B,
    authorUserId: USER_B,
    body: "Secret comment",
    deletedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    mentions: [],
    ...overrides,
  };
}

function makeMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: MESSAGE_B,
    tenantId: TENANT_B,
    threadId: THREAD_B,
    direction: "OUTBOUND",
    channel: "EMAIL",
    subject: "Test",
    bodyText: "Hello",
    bodyHtml: null,
    fromAddress: null,
    toAddresses: ["a@example.com"],
    provider: "resend",
    providerMessageId: "provider-msg-b",
    messageIdHeader: null,
    inReplyTo: null,
    references: null,
    status: "DRAFT",
    sentAt: null,
    receivedAt: null,
    createdByUserId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      commentMention: { deleteMany: mocks.commentMentionDeleteMany, createMany: mocks.commentMentionCreateMany },
      internalComment: { update: mocks.internalCommentUpdate },
    }),
  );
  mocks.logAction.mockResolvedValue(undefined);
});

describe("COMM-01A tenant isolation matrix", () => {
  it("A — thread read: Tenant A cannot read Tenant B thread by raw thread ID", async () => {
    mocks.communicationThreadFindFirst.mockResolvedValue(null);

    const thread = await getCommunicationThreadByIdForTenant(TENANT_A, THREAD_B);

    expect(thread).toBeNull();
    expect(mocks.communicationThreadFindFirst).toHaveBeenCalledWith({
      where: { id: THREAD_B, tenantId: TENANT_A },
      select: expect.any(Object),
    });
  });

  it("B — thread target: Tenant A cannot create a thread targeting Tenant B registration", async () => {
    mocks.registrationFindFirst.mockResolvedValue(null);

    await expect(
      getOrCreateCommunicationThreadForTarget("fc-a", "REGISTRATION", REG_B),
    ).rejects.toMatchObject({
      code: "TARGET_NOT_FOUND",
    } satisfies Partial<CommunicationServiceError>);

    expect(mocks.communicationThreadCreate).not.toHaveBeenCalled();
  });

  it("C — waiting-list target: Tenant A cannot attach a thread to Tenant B waiting-list entry", async () => {
    mocks.waitingListEntryFindFirst.mockResolvedValue(null);

    await expect(
      getOrCreateCommunicationThreadForTarget("fc-a", "WAITING_LIST_ENTRY", WAIT_B),
    ).rejects.toMatchObject({
      code: "TARGET_NOT_FOUND",
    });

    expect(mocks.communicationThreadCreate).not.toHaveBeenCalled();
  });

  it("D — message read: Tenant A cannot read Tenant B communication messages", async () => {
    mocks.communicationThreadFindFirst.mockResolvedValue(null);

    await expect(listCommunicationMessages(TENANT_A, THREAD_B)).rejects.toMatchObject({
      code: "THREAD_NOT_FOUND",
    });
  });

  it("E — message write: Tenant A cannot append a message to Tenant B thread", async () => {
    mocks.communicationThreadFindFirst.mockResolvedValue(null);

    await expect(
      createCommunicationMessage(TENANT_A, THREAD_B, {
        direction: "OUTBOUND",
        bodyText: "cross-tenant attempt",
      }),
    ).rejects.toMatchObject({
      code: "THREAD_NOT_FOUND",
    });

    expect(mocks.communicationMessageCreate).not.toHaveBeenCalled();
  });

  it("F — comment read: Tenant A cannot read Tenant B comments", async () => {
    mocks.communicationThreadFindFirst.mockResolvedValue(null);

    await expect(listInternalComments(TENANT_A, THREAD_B)).rejects.toMatchObject({
      code: "THREAD_NOT_FOUND",
    });
  });

  it("G — comment write: Tenant A cannot comment on Tenant B thread", async () => {
    mocks.communicationThreadFindFirst.mockResolvedValue(null);

    await expect(
      createInternalComment(TENANT_A, THREAD_B, USER_A, "illegal comment"),
    ).rejects.toMatchObject({
      code: "THREAD_NOT_FOUND",
    });

    expect(mocks.internalCommentCreate).not.toHaveBeenCalled();
  });

  it("H — mentions: Tenant A cannot mention a user without valid Tenant A membership", async () => {
    mocks.communicationThreadFindFirst.mockResolvedValue(
      makeThread({ id: THREAD_A, tenantId: TENANT_A, targetId: REG_A }),
    );
    mocks.tenantMembershipFindFirst.mockResolvedValue({ id: "membership-a" });
    mocks.tenantMembershipFindMany.mockResolvedValue([]);

    await expect(
      createInternalComment(TENANT_A, THREAD_A, USER_A, "mention attempt", [USER_B]),
    ).rejects.toMatchObject({
      code: "MENTION_FORBIDDEN",
    });

    expect(mocks.internalCommentCreate).not.toHaveBeenCalled();
  });

  it("I — provider identifiers: providerMessageId lookup is tenant-scoped", async () => {
    mocks.communicationMessageFindFirst.mockResolvedValue(null);

    const message = await getCommunicationMessageByProviderIdForTenant(
      TENANT_A,
      "resend",
      "provider-msg-b",
    );

    expect(message).toBeNull();
  });

  it("J — target tampering: valid targetType with another tenant's targetId fails", async () => {
    mocks.registrationFindFirst.mockResolvedValue(null);

    await expect(
      resolveCommunicationTargetForTenant({
        tenantId: TENANT_A,
        targetType: "REGISTRATION",
        targetId: REG_B,
      }),
    ).rejects.toMatchObject({
      code: "TARGET_NOT_FOUND",
    });
  });

  it("K — valid same-tenant path succeeds", async () => {
    mocks.registrationFindFirst.mockResolvedValue({
      id: REG_A,
      firstName: "Max",
      lastName: "Muster",
      email: "max@example.com",
    });
    mocks.communicationThreadFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue(makeThread({ id: THREAD_A, tenantId: TENANT_A, targetId: REG_A }));
    mocks.communicationThreadCreate.mockResolvedValue(
      makeThread({ id: THREAD_A, tenantId: TENANT_A, targetId: REG_A }),
    );
    mocks.tenantMembershipFindFirst.mockResolvedValue({ id: "membership-a" });
    mocks.tenantMembershipFindMany.mockResolvedValue([{ userId: USER_A }]);
    mocks.internalCommentCreate.mockResolvedValue(
      makeComment({
        id: COMMENT_A,
        tenantId: TENANT_A,
        threadId: THREAD_A,
        authorUserId: USER_A,
        body: "All good",
      }),
    );
    mocks.communicationMessageCreate.mockResolvedValue(
      makeMessage({
        id: "message-a",
        tenantId: TENANT_A,
        threadId: THREAD_A,
      }),
    );

    const thread = await getOrCreateCommunicationThreadForTarget(
      "fc-a",
      "REGISTRATION",
      REG_A,
      USER_A,
    );
    expect(thread.tenantId).toBe(TENANT_A);

    const message = await createCommunicationMessage(TENANT_A, thread.id, {
      direction: "OUTBOUND",
      bodyText: "Draft only",
    });
    expect(message.tenantId).toBe(TENANT_A);

    const comment = await createInternalComment(
      TENANT_A,
      thread.id,
      USER_A,
      "Internal note",
      [USER_A],
    );
    expect(comment.tenantId).toBe(TENANT_A);
  });
});

describe("COMM-01B tenant isolation matrix", () => {
  it("A — Tenant A cannot list Tenant B comments", async () => {
    mocks.communicationThreadFindFirst.mockResolvedValue(null);

    await expect(listInternalComments(TENANT_A, THREAD_B)).rejects.toMatchObject({
      code: "THREAD_NOT_FOUND",
    });
  });

  it("B — Tenant A cannot create comment on Tenant B thread", async () => {
    mocks.communicationThreadFindFirst.mockResolvedValue(null);

    await expect(
      createInternalComment(TENANT_A, THREAD_B, USER_A, "cross tenant"),
    ).rejects.toMatchObject({ code: "THREAD_NOT_FOUND" });
  });

  it("C — Tenant A cannot edit Tenant B comment by raw commentId", async () => {
    mocks.communicationThreadFindFirst.mockResolvedValue(
      makeThread({ id: THREAD_A, tenantId: TENANT_A, targetId: REG_A }),
    );
    mocks.internalCommentFindFirst.mockResolvedValue(null);

    await expect(
      updateInternalComment(TENANT_A, THREAD_A, COMMENT_B, USER_A, "edited"),
    ).rejects.toMatchObject({ code: "COMMENT_NOT_FOUND" });
  });

  it("D — Tenant A cannot delete Tenant B comment", async () => {
    mocks.communicationThreadFindFirst.mockResolvedValue(
      makeThread({ id: THREAD_A, tenantId: TENANT_A, targetId: REG_A }),
    );
    mocks.internalCommentFindFirst.mockResolvedValue(null);

    await expect(
      softDeleteInternalComment(TENANT_A, THREAD_A, COMMENT_B, USER_A),
    ).rejects.toMatchObject({ code: "COMMENT_NOT_FOUND" });
  });

  it("E — Tenant A cannot mention Tenant B user", async () => {
    mocks.communicationThreadFindFirst.mockResolvedValue(
      makeThread({ id: THREAD_A, tenantId: TENANT_A, targetId: REG_A }),
    );
    mocks.tenantMembershipFindFirst.mockResolvedValue({ id: "membership-a" });
    mocks.tenantMembershipFindMany.mockResolvedValue([]);

    await expect(
      createInternalComment(TENANT_A, THREAD_A, USER_A, "hello @other", [USER_B]),
    ).rejects.toMatchObject({ code: "MENTION_FORBIDDEN" });
  });

  it("F — mention candidate search stays tenant-scoped", async () => {
    mocks.tenantMembershipFindMany.mockResolvedValue([
      {
        user: {
          id: USER_A,
          firstName: "Michael",
          lastName: "Duijster",
          email: "michael@fc-a.ch",
          person: null,
        },
      },
    ]);

    const candidates = await listMentionCandidatesForTenant("fc-a", "mi");

    expect(candidates.every((candidate) => candidate.id === USER_A)).toBe(true);
    expect(mocks.tenantMembershipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-a" }),
      }),
    );
  });

  it("G — manipulating threadId with valid Tenant B thread fails", async () => {
    mocks.communicationThreadFindFirst.mockResolvedValue(null);

    await expect(
      createInternalComment(TENANT_A, THREAD_B, USER_A, "illegal"),
    ).rejects.toMatchObject({ code: "THREAD_NOT_FOUND" });
  });

  it("H — Tenant B comment under Tenant A thread fails", async () => {
    mocks.communicationThreadFindFirst.mockResolvedValue(
      makeThread({ id: THREAD_A, tenantId: TENANT_A, targetId: REG_A }),
    );
    mocks.internalCommentFindFirst.mockResolvedValue(
      makeComment({ id: COMMENT_B, tenantId: TENANT_B, threadId: THREAD_B }),
    );

    await expect(
      updateInternalComment(TENANT_A, THREAD_A, COMMENT_B, USER_A, "tamper"),
    ).rejects.toMatchObject({ code: "COMMENT_NOT_FOUND" });
  });

  it("J — valid Tenant A author can create comment and mention Tenant A user", async () => {
    mocks.communicationThreadFindFirst.mockResolvedValue(
      makeThread({ id: THREAD_A, tenantId: TENANT_A, targetId: REG_A }),
    );
    mocks.tenantMembershipFindFirst.mockResolvedValue({ id: "membership-a" });
    mocks.tenantMembershipFindMany.mockResolvedValue([{ userId: USER_A }]);
    mocks.internalCommentCreate.mockResolvedValue(
      makeComment({
        id: COMMENT_A,
        tenantId: TENANT_A,
        threadId: THREAD_A,
        authorUserId: USER_A,
        body: "Hello @Michael",
        mentions: [{ id: "mention-a", tenantId: TENANT_A, commentId: COMMENT_A, mentionedUserId: USER_A, createdAt: new Date() }],
      }),
    );

    const comment = await createInternalComment(TENANT_A, THREAD_A, USER_A, "Hello @Michael", [USER_A]);
    expect(comment.tenantId).toBe(TENANT_A);
    expect(mocks.logAction).toHaveBeenCalled();
  });

  it("K — author can edit own Tenant A comment", async () => {
    mocks.communicationThreadFindFirst.mockResolvedValue(
      makeThread({ id: THREAD_A, tenantId: TENANT_A, targetId: REG_A }),
    );
    mocks.internalCommentFindFirst.mockResolvedValue(
      makeComment({
        id: COMMENT_A,
        tenantId: TENANT_A,
        threadId: THREAD_A,
        authorUserId: USER_A,
        body: "Original",
      }),
    );
    mocks.tenantMembershipFindMany.mockResolvedValue([]);
    mocks.internalCommentUpdate.mockResolvedValue(
      makeComment({
        id: COMMENT_A,
        tenantId: TENANT_A,
        threadId: THREAD_A,
        authorUserId: USER_A,
        body: "Updated",
      }),
    );

    const comment = await updateInternalComment(
      TENANT_A,
      THREAD_A,
      COMMENT_A,
      USER_A,
      "Updated",
      [],
    );

    expect(comment.body).toBe("Updated");
    expect(mocks.logAction).toHaveBeenCalled();
  });

  it("L — other Tenant A user cannot edit author's comment", async () => {
    mocks.communicationThreadFindFirst.mockResolvedValue(
      makeThread({ id: THREAD_A, tenantId: TENANT_A, targetId: REG_A }),
    );
    mocks.internalCommentFindFirst.mockResolvedValue(
      makeComment({
        id: COMMENT_A,
        tenantId: TENANT_A,
        threadId: THREAD_A,
        authorUserId: USER_A,
      }),
    );

    await expect(
      updateInternalComment(TENANT_A, THREAD_A, COMMENT_A, USER_B, "nope"),
    ).rejects.toMatchObject({ code: "COMMENT_FORBIDDEN" });
  });

  it("M — author can soft-delete own Tenant A comment", async () => {
    mocks.communicationThreadFindFirst.mockResolvedValue(
      makeThread({ id: THREAD_A, tenantId: TENANT_A, targetId: REG_A }),
    );
    mocks.internalCommentFindFirst.mockResolvedValue(
      makeComment({
        id: COMMENT_A,
        tenantId: TENANT_A,
        threadId: THREAD_A,
        authorUserId: USER_A,
      }),
    );
    mocks.internalCommentUpdate.mockResolvedValue(
      makeComment({
        id: COMMENT_A,
        tenantId: TENANT_A,
        threadId: THREAD_A,
        authorUserId: USER_A,
        body: "Original",
        deletedAt: new Date(),
      }),
    );

    const comment = await softDeleteInternalComment(TENANT_A, THREAD_A, COMMENT_A, USER_A);
    expect(comment.deletedAt).not.toBeNull();
    expect(mocks.commentMentionDeleteMany).toHaveBeenCalled();
  });

  it("N — deleted comment is returned without body content in list path", async () => {
    mocks.communicationThreadFindFirst.mockResolvedValue(
      makeThread({ id: THREAD_A, tenantId: TENANT_A, targetId: REG_A }),
    );
    mocks.internalCommentFindMany.mockResolvedValue([
      makeComment({
        id: COMMENT_A,
        tenantId: TENANT_A,
        threadId: THREAD_A,
        authorUserId: USER_A,
        body: "Secret",
        deletedAt: new Date(),
      }),
    ]);

    const comments = await listInternalComments(TENANT_A, THREAD_A);
    expect(comments[0]?.deletedAt).not.toBeNull();
    expect(comments[0]?.body).toBe("Secret");
  });

  it("O — target tampering between REGISTRATION and WAITING_LIST_ENTRY cannot cross tenant", async () => {
    mocks.waitingListEntryFindFirst.mockResolvedValue(null);

    await expect(
      resolveCommunicationTargetForTenant({
        tenantId: TENANT_A,
        targetType: "WAITING_LIST_ENTRY",
        targetId: WAIT_B,
      }),
    ).rejects.toMatchObject({ code: "TARGET_NOT_FOUND" });

    mocks.registrationFindFirst.mockResolvedValue(null);

    await expect(
      resolveCommunicationTargetForTenant({
        tenantId: TENANT_A,
        targetType: "REGISTRATION",
        targetId: REG_B,
      }),
    ).rejects.toMatchObject({ code: "TARGET_NOT_FOUND" });
  });
});

describe("resolveCommunicationTargetForTenant — waiting list same-tenant success", () => {
  it("resolves a waiting-list entry inside tenant boundary", async () => {
    mocks.waitingListEntryFindFirst.mockResolvedValue({
      id: WAIT_B,
      registration: {
        firstName: "Anna",
        lastName: "Beispiel",
        email: "anna@example.com",
      },
    });

    const resolved = await resolveCommunicationTargetForTenant({
      tenantId: TENANT_B,
      targetType: "WAITING_LIST_ENTRY",
      targetId: WAIT_B,
    });

    expect(resolved.targetId).toBe(WAIT_B);
  });
});
