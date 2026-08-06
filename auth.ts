import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import {
  resolveSessionPermissionKeys,
  resolveTenantMembershipContext,
} from "@/lib/auth/session-context";

// RPERM-04: tenant context now carried as activeTenantId / activeMembershipId /
// availableTenants, derived exclusively from TenantMembership — never from the
// legacy User.tenantId column. See lib/auth/session-context.ts for the single
// resolution model shared by login and impersonation.
type SessionUserShape = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleKeys: string[];
  permissionKeys: string[];
  isImpersonating: boolean;
  actorUserId?: string;
  actorEmail?: string;
  actorName?: string;
  effectiveUserId?: string;
  activeTenantId: string | null;
  activeMembershipId: string | null;
  availableTenants: { id: string; key: string; name: string }[];
};

function normalizeSessionUserShape(value: Partial<SessionUserShape>): SessionUserShape {
  return {
    id: String(value.id ?? ""),
    email: String(value.email ?? ""),
    firstName: String(value.firstName ?? ""),
    lastName: String(value.lastName ?? ""),
    roleKeys: Array.isArray(value.roleKeys) ? value.roleKeys.map(String) : [],
    permissionKeys: Array.isArray(value.permissionKeys) ? value.permissionKeys.map(String) : [],
    isImpersonating: Boolean(value.isImpersonating),
    actorUserId: typeof value.actorUserId === "string" ? value.actorUserId : undefined,
    actorEmail: typeof value.actorEmail === "string" ? value.actorEmail : undefined,
    actorName: typeof value.actorName === "string" ? value.actorName : undefined,
    effectiveUserId:
      typeof value.effectiveUserId === "string"
        ? value.effectiveUserId
        : String(value.id ?? ""),
    activeTenantId: typeof value.activeTenantId === "string" ? value.activeTenantId : null,
    activeMembershipId:
      typeof value.activeMembershipId === "string" ? value.activeMembershipId : null,
    availableTenants: Array.isArray(value.availableTenants) ? value.availableTenants : [],
  };
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
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

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        // RPERM-04: tenant context and effective permissions are resolved via
        // the single canonical model (TenantMembership + EffectivePermissionResolver),
        // not via User.tenantId or a naive flatten of every assigned role's permissions.
        const tenantContext = await resolveTenantMembershipContext(prisma, user.id);
        const permissionKeys = await resolveSessionPermissionKeys(
          prisma,
          user.id,
          tenantContext.activeTenantId,
        );

        const userRoles = await prisma.userRole.findMany({
          where: { userId: user.id },
          select: { role: { select: { key: true } } },
        });
        const roleKeys = Array.from(new Set(userRoles.map((ur) => ur.role.key)));

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
      if (user) {
        const authUser = normalizeSessionUserShape(user as SessionUserShape);

        token.id = authUser.id;
        token.email = authUser.email;
        token.firstName = authUser.firstName;
        token.lastName = authUser.lastName;
        token.roleKeys = authUser.roleKeys;
        token.permissionKeys = authUser.permissionKeys;
        token.isImpersonating = authUser.isImpersonating;
        token.actorUserId = authUser.actorUserId;
        token.actorEmail = authUser.actorEmail;
        token.actorName = authUser.actorName;
        token.effectiveUserId = authUser.effectiveUserId;
        token.activeTenantId = authUser.activeTenantId;
        token.activeMembershipId = authUser.activeMembershipId;
        token.availableTenants = authUser.availableTenants;
      }

      if (trigger === "update" && session?.user) {
        const updatedUser = normalizeSessionUserShape(
          session.user as Partial<SessionUserShape>
        );

        token.id = updatedUser.id;
        token.email = updatedUser.email;
        token.firstName = updatedUser.firstName;
        token.lastName = updatedUser.lastName;
        token.roleKeys = updatedUser.roleKeys;
        token.permissionKeys = updatedUser.permissionKeys;
        token.isImpersonating = updatedUser.isImpersonating;
        token.actorUserId = updatedUser.actorUserId;
        token.actorEmail = updatedUser.actorEmail;
        token.actorName = updatedUser.actorName;
        token.effectiveUserId = updatedUser.effectiveUserId;
        token.activeTenantId = updatedUser.activeTenantId;
        token.activeMembershipId = updatedUser.activeMembershipId;
        token.availableTenants = updatedUser.availableTenants;
      }

      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = String(token.id ?? "");
        session.user.email = String(token.email ?? "");
        session.user.firstName = String(token.firstName ?? "");
        session.user.lastName = String(token.lastName ?? "");
        session.user.roleKeys = Array.isArray(token.roleKeys) ? token.roleKeys.map(String) : [];
        session.user.permissionKeys = Array.isArray(token.permissionKeys)
          ? token.permissionKeys.map(String)
          : [];
        session.user.isImpersonating = Boolean(token.isImpersonating);
        session.user.actorUserId =
          typeof token.actorUserId === "string" ? token.actorUserId : undefined;
        session.user.actorEmail =
          typeof token.actorEmail === "string" ? token.actorEmail : undefined;
        session.user.actorName =
          typeof token.actorName === "string" ? token.actorName : undefined;
        session.user.effectiveUserId =
          typeof token.effectiveUserId === "string"
            ? token.effectiveUserId
            : session.user.id;
        session.user.activeTenantId =
          typeof token.activeTenantId === "string" ? token.activeTenantId : null;
        session.user.activeMembershipId =
          typeof token.activeMembershipId === "string" ? token.activeMembershipId : null;
        session.user.availableTenants = Array.isArray(token.availableTenants)
          ? token.availableTenants
          : [];
      }

      return session;
    },
  },
  trustHost: true,
});
