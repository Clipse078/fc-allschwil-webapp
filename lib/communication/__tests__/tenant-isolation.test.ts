/**
 * lib/communication/__tests__/tenant-isolation.test.ts
 *
 * COMM-01A: Mandatory cross-tenant isolation test matrix (A–K).
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
  commentMentionCreateMany: vi.fn(),
  registrationFindFirst: vi.fn(),
  waitingListEntryFindFirst: vi.fn(),
  tenantMembershipFindFirst: vi.fn(),
  tenantMembershipFindMany: vi.fn(),
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
    },
    commentMention: {
      createMany: mocks.commentMentionCreateMany,
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
  },
}));

vi.mock("@/lib/tenants/require-tenant", () => ({
  requireTenant: vi.fn().mockResolvedValue({ id: "tenant-a", key: "fc-a" }),
}));

import { resolveCommunicationTargetForTenant } from "@/lib/communication/target-resolver";
import {
  getCommunicationThreadByIdForTenant,
  getCommunicationThreadByInboundTokenForTenant,
  getOrCreateCommunicationThreadForTarget,
} from "@/lib/communication/thread-service";
import {
  createCommunicationMessage,
  getCommunicationMessageByIdForTenant,
  getCommunicationMessageByProviderIdForTenant,
  listCommunicationMessages,
} from "@/lib/communication/message-service";
import { createInternalComment, listInternalComments } from "@/lib/communication/comment-service";
import { CommunicationServiceError } from "@/lib/communication/errors";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const THREAD_B = "thread-b";
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
    expect(mocks.registrationFindFirst).toHaveBeenCalledWith({
      where: { id: REG_B, tenantId: TENANT_A },
      select: expect.any(Object),
    });
  });

  it("C — waiting-list target: Tenant A cannot attach a thread to Tenant B waiting-list entry", async () => {
    mocks.waitingListEntryFindFirst.mockResolvedValue(null);

    await expect(
      getOrCreateCommunicationThreadForTarget("fc-a", "WAITING_LIST_ENTRY", WAIT_B),
    ).rejects.toMatchObject({
      code: "TARGET_NOT_FOUND",
    });

    expect(mocks.communicationThreadCreate).not.toHaveBeenCalled();
    expect(mocks.waitingListEntryFindFirst).toHaveBeenCalledWith({
      where: { id: WAIT_B, tenantId: TENANT_A },
      select: expect.any(Object),
    });
  });

  it("D — message read: Tenant A cannot read Tenant B communication messages", async () => {
    mocks.communicationThreadFindFirst.mockResolvedValue(null);

    await expect(listCommunicationMessages(TENANT_A, THREAD_B)).rejects.toMatchObject({
      code: "THREAD_NOT_FOUND",
    });

    mocks.communicationThreadFindFirst.mockReset();
    mocks.communicationMessageFindFirst.mockResolvedValue(null);

    const message = await getCommunicationMessageByIdForTenant(TENANT_A, MESSAGE_B);
    expect(message).toBeNull();
    expect(mocks.communicationMessageFindFirst).toHaveBeenCalledWith({
      where: { id: MESSAGE_B, tenantId: TENANT_A },
      select: expect.any(Object),
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
      makeThread({ id: "thread-a", tenantId: TENANT_A, targetId: REG_A }),
    );
    mocks.tenantMembershipFindFirst.mockResolvedValue({ id: "membership-a" });
    mocks.tenantMembershipFindMany.mockResolvedValue([]);

    await expect(
      createInternalComment(TENANT_A, "thread-a", USER_A, "mention attempt", [USER_B]),
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
    expect(mocks.communicationMessageFindFirst).toHaveBeenCalledWith({
      where: {
        tenantId: TENANT_A,
        provider: "resend",
        providerMessageId: "provider-msg-b",
      },
      select: expect.any(Object),
    });
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
      .mockResolvedValue(makeThread({ id: "thread-a", tenantId: TENANT_A, targetId: REG_A }));
    mocks.communicationThreadCreate.mockResolvedValue(
      makeThread({ id: "thread-a", tenantId: TENANT_A, targetId: REG_A }),
    );
    mocks.tenantMembershipFindFirst.mockResolvedValue({ id: "membership-a" });
    mocks.tenantMembershipFindMany.mockResolvedValue([{ userId: USER_A }]);
    mocks.internalCommentCreate.mockResolvedValue({
      id: "comment-a",
      tenantId: TENANT_A,
      threadId: "thread-a",
      authorUserId: USER_A,
      body: "All good",
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      mentions: [],
    });
    mocks.communicationMessageCreate.mockResolvedValue(
      makeMessage({
        id: "message-a",
        tenantId: TENANT_A,
        threadId: "thread-a",
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

    const tokenThread = await getCommunicationThreadByInboundTokenForTenant(
      TENANT_A,
      thread.inboundReplyToken,
    );
    expect(tokenThread?.id).toBe(thread.id);
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
    expect(mocks.waitingListEntryFindFirst).toHaveBeenCalledWith({
      where: { id: WAIT_B, tenantId: TENANT_B },
      select: expect.any(Object),
    });
  });
});
