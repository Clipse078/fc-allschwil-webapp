import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import {
  applyTokenToSessionUser,
  applyTrustedJwtState,
  issueTrustedSessionUpdateIntent,
  revokeTrustedSessionUpdateIntent,
  trustedUpdatePayload,
  type SessionUserShape,
} from "@/lib/auth/trusted-session-state";
import {
  resolveSessionPermissionKeys,
  resolveTenantMembershipContext,
} from "@/lib/auth/session-context";

const authResult = NextAuth({
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");

        if (!email || !password) {
          return null;
        }

        let user;
        try {
          user = await prisma.user.findUnique({
            where: { email },
          });
        } catch (lookupErr) {
          console.error(
            "[auth] authorize: user lookup failed",
            lookupErr instanceof Error ? lookupErr.message : String(lookupErr),
          );
          return null;
        }

        if (!user) {
          console.error("[auth] authorize: no user found for email prefix", email.slice(0, 3) + "***");
          return null;
        }

        if (!user.isActive) {
          console.error("[auth] authorize: user inactive");
          return null;
        }

        const isPasswordValid = await verifyPassword(password, user.passwordHash);

        if (!isPasswordValid) {
          console.error("[auth] authorize: bcrypt comparison failed — wrong password or stale hash");
          return null;
        }

        // lastLoginAt is informational — a failure must never block a valid login.
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });
        } catch (updateErr) {
          console.error(
            "[auth] authorize: lastLoginAt update failed (non-fatal)",
            updateErr instanceof Error ? updateErr.message : String(updateErr),
          );
        }

        // RPERM-04: tenant context and effective permissions are resolved via
        // the single canonical model (TenantMembership + EffectivePermissionResolver),
        // not via User.tenantId or a naive flatten of every assigned role's permissions.
        let tenantContext: Awaited<ReturnType<typeof resolveTenantMembershipContext>>;
        let permissionKeys: string[];
        let roleKeys: string[];

        try {
          tenantContext = await resolveTenantMembershipContext(prisma, user.id);
          permissionKeys = await resolveSessionPermissionKeys(
            prisma,
            user.id,
            tenantContext.activeTenantId,
          );

          const userRoles = await prisma.userRole.findMany({
            where: { userId: user.id },
            select: { role: { select: { key: true } } },
          });
          roleKeys = Array.from(new Set(userRoles.map((ur) => ur.role.key)));
        } catch (sessionErr) {
          console.error(
            "[auth] authorize: session-context build failed — tenant/permission/role query threw",
            sessionErr instanceof Error ? sessionErr.message : String(sessionErr),
          );
          return null;
        }

        const authUser: SessionUserShape = {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roleKeys,
          permissionKeys,
          isImpersonating: false,
          effectiveUserId: user.id,
          activeTenantId: tenantContext.activeTenantId,
          activeMembershipId: tenantContext.activeMembershipId,
          availableTenants: tenantContext.availableTenants,
        };

        return authUser;
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user, trigger, session }) => {
      return applyTrustedJwtState({ token, user, trigger, session }, prisma);
    },
    session: async ({ session, token }) => {
      return applyTokenToSessionUser(session, token);
    },
  },
  trustHost: true,
});

export const { handlers, auth, signIn, signOut } = authResult;

async function runTrustedSessionUpdate(
  intent:
    | { kind: "start-impersonation"; actorUserId: string; targetUserId: string }
    | { kind: "stop-impersonation"; actorUserId: string }
    | { kind: "refresh-effective-user"; actorUserId: string },
) {
  const capability = issueTrustedSessionUpdateIntent(intent);
  try {
    return await authResult.unstable_update(
      trustedUpdatePayload(capability) as never,
    );
  } finally {
    revokeTrustedSessionUpdateIntent(capability);
  }
}

export function startImpersonationSession(
  actorUserId: string,
  targetUserId: string,
) {
  return runTrustedSessionUpdate({
    kind: "start-impersonation",
    actorUserId,
    targetUserId,
  });
}

export function stopImpersonationSession(actorUserId: string) {
  return runTrustedSessionUpdate({
    kind: "stop-impersonation",
    actorUserId,
  });
}

export function refreshEffectiveUserSession(actorUserId: string) {
  return runTrustedSessionUpdate({
    kind: "refresh-effective-user",
    actorUserId,
  });
}
