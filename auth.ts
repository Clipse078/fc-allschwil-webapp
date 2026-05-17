import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import type { SessionTenant } from "@/types/next-auth";

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
  activeTenantId: string;
  activeTenantSlug: string;
  activeTenantName: string;
  availableTenants: SessionTenant[];
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
    activeTenantId: typeof value.activeTenantId === "string" ? value.activeTenantId : "",
    activeTenantSlug: typeof value.activeTenantSlug === "string" ? value.activeTenantSlug : "",
    activeTenantName: typeof value.activeTenantName === "string" ? value.activeTenantName : "",
    availableTenants: Array.isArray(value.availableTenants) ? value.availableTenants : [],
  };
}

/**
 * Resolves the active tenant for a user at login time.
 * Priority: isDefault UserTenant → first UserTenant → fc-allschwil fallback.
 * Wrapped in try/catch so login works even if migration hasn't been applied yet.
 */
async function resolveTenantContext(userId: string): Promise<{
  activeTenantId: string;
  activeTenantSlug: string;
  activeTenantName: string;
  availableTenants: SessionTenant[];
}> {
  const empty = {
    activeTenantId: "",
    activeTenantSlug: "",
    activeTenantName: "",
    availableTenants: [] as SessionTenant[],
  };

  try {
    const userTenants = await prisma.userTenant.findMany({
      where: { userId },
      include: {
        tenant: {
          select: { id: true, slug: true, name: true, displayName: true },
        },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    if (userTenants.length > 0) {
      const availableTenants: SessionTenant[] = userTenants.map((ut) => ({
        id: ut.tenant.id,
        slug: ut.tenant.slug ?? "",
        name: ut.tenant.name ?? "",
        displayName: ut.tenant.displayName ?? null,
      }));

      const active = userTenants[0].tenant;
      return {
        activeTenantId: active.id,
        activeTenantSlug: active.slug ?? "",
        activeTenantName: active.displayName ?? active.name ?? "",
        availableTenants,
      };
    }

    // No UserTenant rows — fall back to the default platform tenant
    const fallback = await prisma.tenant.findFirst({
      where: { slug: "fc-allschwil", isActive: true },
      select: { id: true, slug: true, name: true, displayName: true },
    });

    if (fallback) {
      const t: SessionTenant = {
        id: fallback.id,
        slug: fallback.slug ?? "",
        name: fallback.name ?? "",
        displayName: fallback.displayName ?? null,
      };
      return {
        activeTenantId: t.id,
        activeTenantSlug: t.slug,
        activeTenantName: t.displayName ?? t.name,
        availableTenants: [t],
      };
    }

    return empty;
  } catch {
    // Migration not yet applied — return empty context so login still works
    return empty;
  }
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

        console.log("[auth-debug] authorize:start", {
          email,
          hasPassword: Boolean(password),
          nodeEnv: process.env.NODE_ENV ?? null,
          appEnv: process.env.APP_ENV ?? null,
          hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
          databaseUrlHost: process.env.DATABASE_URL
            ? (() => {
                try {
                  return new URL(process.env.DATABASE_URL).host;
                } catch {
                  return "invalid";
                }
              })()
            : null,
          databaseUrlPath: process.env.DATABASE_URL
            ? (() => {
                try {
                  return new URL(process.env.DATABASE_URL).pathname;
                } catch {
                  return "invalid";
                }
              })()
            : null,
        });

        if (!email || !password) {
          console.log("[auth-debug] authorize:missing-credentials", {
            hasEmail: Boolean(email),
            hasPassword: Boolean(password),
          });
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            userRoles: {
              include: {
                role: {
                  include: {
                    rolePermissions: {
                      include: { permission: true },
                    },
                  },
                },
              },
            },
          },
        });

        console.log("[auth-debug] authorize:user-query-result", {
          email,
          userFound: Boolean(user),
          userId: user?.id ?? null,
          isActive: user?.isActive ?? null,
          firstName: user?.firstName ?? null,
          lastName: user?.lastName ?? null,
          roleCount: user?.userRoles?.length ?? 0,
          passwordHashPrefix: user?.passwordHash ? user.passwordHash.slice(0, 7) : null,
        });

        if (!user) {
          console.log("[auth-debug] authorize:user-not-found", { email });
          return null;
        }

        if (!user.isActive) {
          console.log("[auth-debug] authorize:user-inactive", { email, userId: user.id });
          return null;
        }

        const isPasswordValid = await verifyPassword(password, user.passwordHash);

        console.log("[auth-debug] authorize:password-check", {
          email,
          userId: user.id,
          isPasswordValid,
        });

        if (!isPasswordValid) {
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        const roleKeys = Array.from(
          new Set(user.userRoles.map((ur) => ur.role.key)),
        );
        const permissionKeys = Array.from(
          new Set(
            user.userRoles.flatMap((ur) =>
              ur.role.rolePermissions.map((rp) => rp.permission.key),
            ),
          ),
        );

        const tenantCtx = await resolveTenantContext(user.id);

        console.log("[auth-debug] authorize:success", {
          email,
          userId: user.id,
          roleKeys,
          permissionKeys,
          activeTenantSlug: tenantCtx.activeTenantSlug,
          availableTenantCount: tenantCtx.availableTenants.length,
        });

        const authUser: SessionUserShape = {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roleKeys,
          permissionKeys,
          isImpersonating: false,
          effectiveUserId: user.id,
          ...tenantCtx,
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
        token.activeTenantSlug = authUser.activeTenantSlug;
        token.activeTenantName = authUser.activeTenantName;
        token.availableTenants = authUser.availableTenants;
      }

      if (trigger === "update" && session?.user) {
        const updatedUser = normalizeSessionUserShape(
          session.user as Partial<SessionUserShape>,
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
        token.activeTenantSlug = updatedUser.activeTenantSlug;
        token.activeTenantName = updatedUser.activeTenantName;
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
        session.user.roleKeys = Array.isArray(token.roleKeys)
          ? token.roleKeys.map(String)
          : [];
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
        session.user.activeTenantId = typeof token.activeTenantId === "string"
          ? token.activeTenantId
          : "";
        session.user.activeTenantSlug = typeof token.activeTenantSlug === "string"
          ? token.activeTenantSlug
          : "";
        session.user.activeTenantName = typeof token.activeTenantName === "string"
          ? token.activeTenantName
          : "";
        session.user.availableTenants = Array.isArray(token.availableTenants)
          ? token.availableTenants
          : [];
      }

      return session;
    },
  },
  trustHost: true,
});
