/**
 * CmsFeatureStatusBadge
 *
 * Renders a styled badge for a CMS feature's readiness status.
 * Uses the shared status display helpers from lib/cms/types.ts.
 */

import type { CmsFeatureStatus } from "@/lib/cms/types";
import {
  CMS_STATUS_LABEL,
  CMS_STATUS_BADGE_CLASS,
  CMS_STATUS_DOT_CLASS,
} from "@/lib/cms/types";

type Props = {
  status: CmsFeatureStatus;
  showDot?: boolean;
};

export function CmsFeatureStatusBadge({ status, showDot = true }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CMS_STATUS_BADGE_CLASS[status]}`}
    >
      {showDot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${CMS_STATUS_DOT_CLASS[status]}`}
        />
      )}
      {CMS_STATUS_LABEL[status]}
    </span>
  );
}
