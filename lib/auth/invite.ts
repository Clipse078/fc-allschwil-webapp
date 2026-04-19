import { UserTokenType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createPlainToken, hashToken } from "@/lib/auth/token";

const INVITE_TTL_HOURS = 72;

export async function createInviteToken(args: {
  userId: string;
  createdByUserId?: string | null;
}) {
  const token = createPlainToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

  await prisma.userToken.updateMany({
    where: {
      userId: args.userId,
      type: UserTokenType.INVITE,
      consumedAt: null,
    },
    data: {
      consumedAt: new Date(),
    },
  });

  await prisma.userToken.create({
    data: {
      userId: args.userId,
      type: UserTokenType.INVITE,
      tokenHash,
      expiresAt,
      createdByUserId: args.createdByUserId ?? null,
    },
  });

  return {
    token,
    expiresAt,
  };
}

export async function consumeInviteToken(token: string) {
  const tokenHash = hashToken(token);

  const record = await prisma.userToken.findFirst({
    where: {
      tokenHash,
      type: UserTokenType.INVITE,
      consumedAt: null,
    },
    include: {
      user: {
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      },
    },
  });

  if (!record) {
    return { ok: false as const, error: "Einladung nicht gefunden." };
  }

  if (record.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, error: "Einladung ist abgelaufen." };
  }

  return {
    ok: true as const,
    record,
  };
}
