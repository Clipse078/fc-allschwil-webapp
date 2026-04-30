import { canAccessScopedEntity } from "@/lib/scoped/can-access-scoped-entity";
import { getCurrentScopedActor } from "@/lib/scoped/get-current-scoped-actor";
import { getCurrentPersonId } from "@/lib/tasks/get-current-person-id";
import { scopedTaskSources } from "@/lib/tasks/scoped-task-registry";
import type { ScopedTaskPreviewItem } from "@/lib/tasks/scoped-task-types";

export type MyTaskPreviewItem = ScopedTaskPreviewItem;

export async function getMyTaskPreview(limit = 5): Promise<MyTaskPreviewItem[]> {
  const personId = await getCurrentPersonId();

  if (!personId) return [];

  const actor = await getCurrentScopedActor();

  const previews = await Promise.all(
    scopedTaskSources.map((source) => source.previewForPerson(personId, limit)),
  );

  return previews
    .flat()
    .filter((task) =>
      canAccessScopedEntity(
        {
          scopeType: task.scopeType,
          audience: task.audience ?? { isPublic: true },
        },
        {
          personId: actor.personId,
          roleIds: actor.roleIds,
        },
      ),
    )
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    })
    .slice(0, limit);
}
