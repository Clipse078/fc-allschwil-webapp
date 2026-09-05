import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log-action";
import { hashPassword } from "@/lib/auth/password";
import {
  acquirePlatformSuperAdminMutationLock,
  platformSuperAdminAssignmentWhere,
  usablePlatformSuperAdminWhere,
} from "@/lib/security/platform-superadmin";

export type PlatformAccountErrorCode =
  | "USER_NOT_FOUND"
  | "INVALID_IDENTITY"
  | "EMAIL_TAKEN"
  | "LAST_SUPER_ADMIN"
  | "INACTIVE_USER";

export class PlatformAccountDomainError extends Error {
  constructor(
    public readonly code: PlatformAccountErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PlatformAccountDomainError";
  }
}

const emailSchema = z.string().trim().max(320).email();

export function normalizePlatformAccountEmail(email: string): string {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    throw new PlatformAccountDomainError(
      "INVALID_IDENTITY",
      "Bitte gib eine gültige E-Mail-Adresse ein.",
    );
  }
  return parsed.data.toLowerCase();
}

export type UpdatePlatformAccountInput = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  actorUserId: string;
};

export async function updatePlatformAccount(input: UpdatePlatformAccountInput) {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = normalizePlatformAccountEmail(input.email);
  if (!firstName || !lastName) {
    throw new PlatformAccountDomainError(
      "INVALID_IDENTITY",
      "Vorname und Nachname sind erforderlich.",
    );
  }

  let before:
    | {
        firstName: string;
        lastName: string;
        email: string;
        isActive: boolean;
      }
    | undefined;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await acquirePlatformSuperAdminMutationLock(tx);

      const user = await tx.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          isActive: true,
          userRoles: {
            where: platformSuperAdminAssignmentWhere,
            select: { id: true },
            take: 1,
          },
        },
      });
      if (!user) {
        throw new PlatformAccountDomainError(
          "USER_NOT_FOUND",
          "Benutzer nicht gefunden.",
        );
      }

      if (user.isActive && !input.isActive && user.userRoles.length > 0) {
        const otherUsableSuperAdmins = await tx.userRole.count({
          where: {
            ...usablePlatformSuperAdminWhere,
            userId: { not: user.id },
          },
        });
        if (otherUsableSuperAdmins === 0) {
          throw new PlatformAccountDomainError(
            "LAST_SUPER_ADMIN",
            "Der letzte aktive SCE Super Admin kann nicht deaktiviert werden.",
          );
        }
      }

      before = {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isActive: user.isActive,
      };
      const securitySensitiveChange =
        user.email !== email || (user.isActive && !input.isActive);

      return tx.user.update({
        where: { id: user.id },
        data: {
          firstName,
          lastName,
          email,
          isActive: input.isActive,
          ...(securitySensitiveChange
            ? { passwordChangedAt: new Date() }
            : {}),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          isActive: true,
        },
      });
    });

    await logAction({
      actorUserId: input.actorUserId,
      moduleKey: "users",
      entityType: "User",
      entityId: updated.id,
      action: "PLATFORM_ACCOUNT_UPDATE",
      beforeJson: before,
      afterJson: {
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
        isActive: updated.isActive,
      },
    });

    return updated;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new PlatformAccountDomainError(
        "EMAIL_TAKEN",
        "Diese E-Mail ist bereits vergeben.",
      );
    }
    throw error;
  }
}

export async function resetPlatformAccountPassword(input: {
  userId: string;
  password: string;
  actorUserId: string;
}): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, isActive: true },
  });
  if (!user) {
    throw new PlatformAccountDomainError(
      "USER_NOT_FOUND",
      "Benutzer nicht gefunden.",
    );
  }
  if (!user.isActive) {
    throw new PlatformAccountDomainError(
      "INACTIVE_USER",
      "Das Passwort eines deaktivierten Kontos kann nicht geändert werden.",
    );
  }

  const passwordHash = await hashPassword(input.password);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, passwordChangedAt: new Date() },
  });

  await logAction({
    actorUserId: input.actorUserId,
    moduleKey: "users",
    entityType: "User",
    entityId: user.id,
    action: "PLATFORM_PASSWORD_RESET",
  });
}
