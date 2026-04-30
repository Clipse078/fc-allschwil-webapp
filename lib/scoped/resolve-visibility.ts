export type VisibilityAudience = {
  isPublic?: boolean;
  roleIds?: string[];
  personIds?: string[];
} | null | undefined;

type Params = {
  audience: VisibilityAudience;
  userId: string | null | undefined;
  userRoleIds: string[];
};

export function canUserAccess({
  audience,
  userId,
  userRoleIds,
}: Params): boolean {
  // No audience defined → fallback to public
  if (!audience) return true;

  // Public
  if (audience.isPublic !== false) return true;

  // Person-specific
  if (audience.personIds && audience.personIds.length > 0) {
    if (!userId) return false;
    return audience.personIds.includes(userId);
  }

  // Role-specific
  if (audience.roleIds && audience.roleIds.length > 0) {
    return audience.roleIds.some((roleId) =>
      userRoleIds.includes(roleId)
    );
  }

  // Default fallback
  return false;
}
