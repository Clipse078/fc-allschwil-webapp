import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  state: {
    draft: null as Record<string, unknown> | null,
    links: [] as Array<Record<string, unknown>>,
  },
  thread: vi.fn(),
  recipient: vi.fn(),
  validateAttachments: vi.fn(),
  getMessage: vi.fn(),
  messageFindFirst: vi.fn(),
  messageCreate: vi.fn(),
  messageUpdate: vi.fn(),
  linksDeleteMany: vi.fn(),
  linksCreateMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    communicationMessage: {
      findFirst: mocks.messageFindFirst,
    },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/communication/thread-service", () => ({
  requireCommunicationThreadForTenant: mocks.thread,
}));
vi.mock("@/lib/communication/recipient-resolver", () => ({
  resolveCommunicationRecipientForTarget: mocks.recipient,
}));
vi.mock("@/lib/communication/message-service", () => ({
  getCommunicationMessageByIdForTenant: mocks.getMessage,
}));
vi.mock("@/lib/communication/attachment-service", () => ({
  CommunicationAttachmentServiceError: class CommunicationAttachmentServiceError extends Error {},
  validateOutboundAttachmentSelection: mocks.validateAttachments,
}));

import {
  createCommunicationDraft,
  getCommunicationDraftForThread,
  updateCommunicationDraft,
} from "@/lib/communication/draft-service";

const now = new Date("2026-08-23T05:00:00.000Z");

function draftRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "draft-a",
    tenantId: "tenant-a",
    threadId: "thread-a",
    direction: "OUTBOUND",
    channel: "EMAIL",
    subject: "Betreff",
    bodyText: "Inhalt",
    bodyHtml: null,
    fromAddress: null,
    toAddresses: ["anna@example.com"],
    provider: null,
    providerEventId: null,
    providerMessageId: null,
    replyToAddress: null,
    attachments: null,
    deliveryError: null,
    messageIdHeader: null,
    inReplyTo: null,
    references: null,
    status: "DRAFT",
    sentAt: null,
    receivedAt: null,
    retryOfMessageId: null,
    createdByUserId: "actor-a",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.draft = null;
  mocks.state.links = [];
  mocks.thread.mockResolvedValue({
    id: "thread-a",
    tenantId: "tenant-a",
    targetType: "REGISTRATION",
    targetId: "reg-a",
  });
  mocks.recipient.mockResolvedValue({
    available: true,
    sendAllowed: true,
    email: "anna@example.com",
    displayName: "Anna",
    unavailableReason: null,
  });
  mocks.validateAttachments.mockImplementation(
    async ({ attachmentIds }: { attachmentIds: string[] }) => attachmentIds,
  );
  mocks.getMessage.mockImplementation(async () => mocks.state.draft);
  mocks.messageFindFirst.mockImplementation(async () =>
    mocks.state.draft ? { id: mocks.state.draft.id } : null,
  );
  mocks.messageCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    mocks.state.draft = draftRecord(data);
    return { id: "draft-a" };
  });
  mocks.messageUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    mocks.state.draft = {
      ...mocks.state.draft,
      ...data,
      updatedAt: new Date("2026-08-23T05:15:00.000Z"),
    };
    return mocks.state.draft;
  });
  mocks.linksDeleteMany.mockImplementation(async () => {
    mocks.state.links = [];
    return { count: 0 };
  });
  mocks.linksCreateMany.mockImplementation(
    async ({ data }: { data: Array<Record<string, unknown>> }) => {
      mocks.state.links = data;
      return { count: data.length };
    },
  );
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      communicationMessage: {
        findFirst: mocks.messageFindFirst,
        create: mocks.messageCreate,
        update: mocks.messageUpdate,
      },
      communicationMessageAttachment: {
        deleteMany: mocks.linksDeleteMany,
        createMany: mocks.linksCreateMany,
      },
    }),
  );
});

describe("COMM-04C persistent communication drafts", () => {
  it("creates one server-side DRAFT with tenant, author and ordered attachment associations", async () => {
    const result = await createCommunicationDraft({
      tenantId: "tenant-a",
      threadId: "thread-a",
      actorUserId: "actor-a",
      subject: " Anmeldung ",
      bodyText: " Hallo Anna ",
      attachmentIds: ["attachment-b", "attachment-a"],
    });

    expect(mocks.messageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-a",
        threadId: "thread-a",
        subject: "Anmeldung",
        bodyText: "Hallo Anna",
        status: "DRAFT",
        createdByUserId: "actor-a",
        toAddresses: ["anna@example.com"],
      }),
      select: { id: true },
    });
    expect(mocks.state.links).toEqual([
      expect.objectContaining({ attachmentId: "attachment-b", sortOrder: 0 }),
      expect.objectContaining({ attachmentId: "attachment-a", sortOrder: 1 }),
    ]);
    expect(result).toMatchObject({
      id: "draft-a",
      status: "DRAFT",
      provider: null,
      providerMessageId: null,
      sentAt: null,
    });
  });

  it("updates the same draft ID and reconciles removed and reordered associations", async () => {
    mocks.state.draft = draftRecord();
    mocks.state.links = [
      { attachmentId: "attachment-a", sortOrder: 0 },
      { attachmentId: "attachment-b", sortOrder: 1 },
    ];

    const result = await updateCommunicationDraft({
      tenantId: "tenant-a",
      threadId: "thread-a",
      draftId: "draft-a",
      actorUserId: "actor-a",
      subject: "Neu",
      bodyText: "Geändert",
      attachmentIds: ["attachment-b"],
    });

    expect(mocks.messageCreate).not.toHaveBeenCalled();
    expect(mocks.messageUpdate).toHaveBeenCalledWith({
      where: { id: "draft-a" },
      data: {
        subject: "Neu",
        bodyText: "Geändert",
        toAddresses: ["anna@example.com"],
      },
    });
    expect(mocks.linksDeleteMany).toHaveBeenCalled();
    expect(mocks.state.links).toEqual([
      expect.objectContaining({ attachmentId: "attachment-b", sortOrder: 0 }),
    ]);
    expect(result).toMatchObject({ id: "draft-a", subject: "Neu", status: "DRAFT" });
    expect((result.updatedAt as Date).getTime()).toBeGreaterThan(now.getTime());
  });

  it("loads the stable draft for a tenant-owned thread", async () => {
    mocks.state.draft = draftRecord();

    const result = await getCommunicationDraftForThread("tenant-a", "thread-a");

    expect(mocks.messageFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-a",
          threadId: "thread-a",
          status: "DRAFT",
        }),
      }),
    );
    expect(result).toMatchObject({ id: "draft-a", subject: "Betreff", bodyText: "Inhalt" });
  });

  it("denies foreign-tenant draft updates without changing associations", async () => {
    mocks.state.draft = draftRecord({ tenantId: "tenant-b" });
    mocks.messageFindFirst.mockResolvedValue(null);

    await expect(
      updateCommunicationDraft({
        tenantId: "tenant-a",
        threadId: "thread-a",
        draftId: "draft-tenant-b",
        actorUserId: "actor-a",
        subject: "Nope",
        bodyText: "Nope",
      }),
    ).rejects.toMatchObject({ code: "MESSAGE_NOT_FOUND" });

    expect(mocks.messageUpdate).not.toHaveBeenCalled();
    expect(mocks.linksDeleteMany).not.toHaveBeenCalled();
  });

  it("keeps archived targets read-only", async () => {
    mocks.recipient.mockResolvedValue({
      available: true,
      sendAllowed: false,
      email: "anna@example.com",
      unavailableReason: "Dieser Eintrag ist abgeschlossen.",
    });

    await expect(
      createCommunicationDraft({
        tenantId: "tenant-a",
        threadId: "thread-a",
        actorUserId: "actor-a",
        subject: "Archiv",
        bodyText: "Nicht speichern",
      }),
    ).rejects.toMatchObject({ code: "SEND_FORBIDDEN" });
    expect(mocks.messageCreate).not.toHaveBeenCalled();
  });

  it("uses the same shared context resolution for Waiting List", async () => {
    mocks.thread.mockResolvedValue({
      id: "thread-a",
      tenantId: "tenant-a",
      targetType: "WAITING_LIST_ENTRY",
      targetId: "wait-a",
    });

    await createCommunicationDraft({
      tenantId: "tenant-a",
      threadId: "thread-a",
      actorUserId: "actor-a",
      subject: "Warteliste",
      bodyText: "Guten Tag",
    });

    expect(mocks.recipient).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      targetType: "WAITING_LIST_ENTRY",
      targetId: "wait-a",
    });
  });
});
