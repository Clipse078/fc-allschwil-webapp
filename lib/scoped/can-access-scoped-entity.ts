import type {
  ScopedVisibilityActor,
  ScopedVisibilityEntity,
} from "@/lib/scoped/scoped-visibility-types";

export function canAccessScopedEntity(
  entity: ScopedVisibilityEntity,
  actor: ScopedVisibilityActor,
) {
  const audience = entity.audience;

  if (!audience) return true;
  if (audience.isPublic) return true;

  const actorPersonId = actor.personId ?? null;
  const actorRoleIds = actor.roleIds ?? [];

  if (
    actorPersonId &&
    audience.personIds?.some((personId) => personId === actorPersonId)
  ) {
    return true;
  }

  if (
    audience.roleIds?.some((roleId) => actorRoleIds.includes(roleId))
  ) {
    return true;
  }

  return false;
}
