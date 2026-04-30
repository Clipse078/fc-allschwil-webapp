import type { ScopedTaskSourceAdapter } from "@/lib/tasks/scoped-task-types";
import { registrationTaskSource } from "@/lib/tasks/sources/registration-task-source";

export const scopedTaskSources: ScopedTaskSourceAdapter[] = [
  registrationTaskSource,

  // Future adapters plug in here:
  // meetingTaskSource,
  // initiativeTaskSource,
  // materialTaskSource,
  // strategyBuilderTaskSource,
  // trainingBuilderTaskSource,
  // tacticsBuilderTaskSource,
];

export function getScopedTaskSourceByTaskIdPrefix(_taskId: string) {
  // Current DB task ids are registration workflow step ids.
  // Later we should use source-prefixed ids, e.g. REGISTRATION:<id>, MEETING:<id>.
  return registrationTaskSource;
}
