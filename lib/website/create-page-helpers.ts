export type CreatePageFeedback =
  | { kind: "success"; pageId: string }
  | { kind: "duplicate"; slug: string }
  | { kind: "forbidden" }
  | { kind: "missing-fields" }
  | { kind: "invalid-template" }
  | null;

export function getCreatePageFeedback(
  status?: string,
  created?: string,
  slug?: string,
): CreatePageFeedback {
  if (created) return { kind: "success", pageId: created };
  if (!status) return null;
  if (status === "create-duplicate-slug") return { kind: "duplicate", slug: slug ?? "" };
  if (status === "create-missing-fields") return { kind: "missing-fields" };
  if (status === "create-invalid-template") return { kind: "invalid-template" };
  if (status === "forbidden") return { kind: "forbidden" };
  return null;
}
