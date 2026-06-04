import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
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
      /** Slice 11.2b: tenant FK carried in JWT. Null for legacy/unset users. */
      tenantId?: string | null;
    };
  }

  interface User {
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
    /** Slice 11.2b: tenant FK carried in JWT. Null for legacy/unset users. */
    tenantId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    roleKeys?: string[];
    permissionKeys?: string[];
    isImpersonating?: boolean;
    actorUserId?: string;
    actorEmail?: string;
    actorName?: string;
    effectiveUserId?: string;
    /** Slice 11.2b: tenant FK carried in JWT. Null for legacy/unset users. */
    tenantId?: string | null;
  }
}
