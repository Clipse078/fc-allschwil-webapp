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
      activeTenantId?: string;
      activeTenantSlug?: string;
      activeTenantName?: string;
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
    activeTenantId?: string;
    activeTenantSlug?: string;
    activeTenantName?: string;
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
    activeTenantId?: string;
    activeTenantSlug?: string;
    activeTenantName?: string;
  }
}
