import type { WebsiteBlockStatus } from "@/lib/homepage/types";
import { BLOCK_STATUS_BADGE_CLASS, BLOCK_STATUS_LABEL } from "@/lib/homepage/types";

export default function HomepageBlockStatusBadge({ status }: { status: WebsiteBlockStatus }) {
  const cls = BLOCK_STATUS_BADGE_CLASS[status] ?? BLOCK_STATUS_BADGE_CLASS.DRAFT;
  const label = BLOCK_STATUS_LABEL[status] ?? status;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}
