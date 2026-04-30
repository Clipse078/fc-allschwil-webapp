import type {
  ScopedVisibilityAudience,
  ScopedVisibilityScopeType,
} from "@/lib/scoped/scoped-visibility-types";

export type ScopedTaskSource =
  | "REGISTRATION"
  | "MEETING"
  | "INITIATIVE"
  | "MATERIAL"
  | "STRATEGY"
  | "TRAINING_BUILDER"
  | "TACTICS_BUILDER";

export type ScopedTaskScopeType = ScopedVisibilityScopeType;

export type ScopedTaskStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "DONE";

export type ScopedTaskPreviewItem = {
  id: string;

  source: ScopedTaskSource;
  sourceLabel: string;

  title: string;
  href: string;

  personLabel: string;

  dueDate: string | null;
  isOverdue: boolean;

  scopeType?: ScopedTaskScopeType | null;
  scopeLabel?: string | null;

  audience?: ScopedVisibilityAudience | null;
};

export type ScopedTaskSourceAdapter = {
  source: ScopedTaskSource;

  countForPerson: (personId: string) => Promise<number>;

  previewForPerson: (
    personId: string,
    limit: number
  ) => Promise<ScopedTaskPreviewItem[]>;

  completeTask?: (
    taskId: string,
    personId: string
  ) => Promise<
    | { ok: true }
    | { ok: false; status: number; error: string }
  >;
};
