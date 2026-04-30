export type ScopedVisibilityScopeType =
  | "VEREIN"
  | "DIVISION"
  | "DEPARTMENT"
  | "SUB_DEPARTMENT"
  | "TEAM";

export type ScopedVisibilityAudience = {
  /**
   * Public inside the tenant / club.
   */
  isPublic?: boolean;

  /**
   * Visible for users with one of these role ids.
   */
  roleIds?: string[];

  /**
   * Visible for specific persons.
   */
  personIds?: string[];
};

export type ScopedVisibilityEntity = {
  scopeType?: ScopedVisibilityScopeType | null;
  scopeId?: string | null;
  audience?: ScopedVisibilityAudience | null;
};

export type ScopedVisibilityActor = {
  personId?: string | null;
  roleIds?: string[];
};
