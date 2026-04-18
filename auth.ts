import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";

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
                      include: {
                        permission: true,
                      },
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
          console.log("[auth-debug] authorize:user-inactive", {
            email,
            userId: user.id,
          });
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

        const roleKeys = Array.from(new Set(user.userRoles.map((userRole) => userRole.role.key)));
        const permissionKeys = Array.from(
          new Set(
            user.userRoles.flatMap((userRole) =>
              userRole.role.rolePermissions.map(
                (rolePermission) => rolePermission.permission.key
              )
            )
          )
        );

        console.log("[auth-debug] authorize:success", {
          email,
          userId: user.id,
          roleKeys,
          permissionKeys,
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
      }

      return session;
    },
  },
  trustHost: true,
});