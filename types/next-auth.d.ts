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
      /**
       * RPERM-04: single tenant-resolution model.
       *
       * Derived exclusively from active TenantMembership rows at sign-in —
       * never from the legacy User.tenantId column. activeTenantId is the
       * tenant the user is currently operating in; activeMembershipId is the
       * backing TenantMembership row; availableTenants lists every tenant the
       * user holds an active membership in (foundation for future tenant
       * switching — only one entry is selectable as "active" today).
       *
       * Null when the user holds no active tenant membership (e.g. a
       * platform-only administrator).
       */
      activeTenantId: string | null;
      activeMembershipId: string | null;
      availableTenants: { id: string; key: string; name: string }[];
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
    /** RPERM-04: see Session.user.activeTenantId. */
    activeTenantId: string | null;
    activeMembershipId: string | null;
    availableTenants: { id: string; key: string; name: string }[];
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
    authorizationContextVersion?: number;
    /** RPERM-04: see Session.user.activeTenantId. */
    activeTenantId?: string | null;
    activeMembershipId?: string | null;
    availableTenants?: { id: string; key: string; name: string }[];
  }
}
