import "next-auth";
import "next-auth/jwt";

export type SessionTenant = {
  id: string;
  slug: string;
  name: string;
  displayName: string | null;
};

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
      // Tenant context
      activeTenantId: string;
      activeTenantSlug: string;
      activeTenantName: string;
      availableTenants: SessionTenant[];
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
    // Tenant context
    activeTenantId: string;
    activeTenantSlug: string;
    activeTenantName: string;
    availableTenants: SessionTenant[];
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
    // Tenant context
    activeTenantId?: string;
    activeTenantSlug?: string;
    activeTenantName?: string;
    availableTenants?: SessionTenant[];
  }
}
