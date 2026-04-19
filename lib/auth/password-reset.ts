import { UserTokenType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createPlainToken, hashToken } from "@/lib/auth/token";

const PASSWORD_RESET_TTL_HOURS = 24;

export async function createPasswordResetToken(args: {
  userId: string;
  createdByUserId?: string | null;
}) {
  const token = createPlainToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_HOURS * 60 * 60 * 1000);

  await prisma.userToken.updateMany({
    where: {
      userId: args.userId,
      type: UserTokenType.PASSWORD_RESET,
      consumedAt: null,
    },
    data: {
      consumedAt: new Date(),
    },
  });

  await prisma.userToken.create({
    data: {
      userId: args.userId,
      type: UserTokenType.PASSWORD_RESET,
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

export async function consumePasswordResetToken(token: string) {
  const tokenHash = hashToken(token);

  const record = await prisma.userToken.findFirst({
    where: {
      tokenHash,
      type: UserTokenType.PASSWORD_RESET,
      consumedAt: null,
    },
    include: {
      user: true,
    },
  });

  if (!record) {
    return { ok: false as const, error: "Reset-Link nicht gefunden." };
  }

  if (record.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, error: "Reset-Link ist abgelaufen." };
  }

  return {
    ok: true as const,
    record,
  };
}
