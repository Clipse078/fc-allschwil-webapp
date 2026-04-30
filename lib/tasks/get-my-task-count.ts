import { getCurrentPersonId } from "@/lib/tasks/get-current-person-id";
import { scopedTaskSources } from "@/lib/tasks/scoped-task-registry";

export async function getMyTaskCount() {
  const personId = await getCurrentPersonId();

  if (!personId) return 0;

  const counts = await Promise.all(
    scopedTaskSources.map((source) => source.countForPerson(personId)),
  );

  return counts.reduce((total, count) => total + count, 0);
}
