"use client";

import TeamVisibilityControls from "@/components/admin/teams/TeamVisibilityControls";

type Props = {
  teamId: string;
  websiteVisible: boolean;
  infoboardVisible: boolean;
  canManage: boolean;
};

/**
 * TEAM-COCKPIT-PREMIUM-01D: shared workspace header controls — visibility
 * toggles preserved in the stable team context across all cockpit routes.
 */
export default function TeamCockpitVisibilityBar({
  teamId,
  websiteVisible,
  infoboardVisible,
  canManage,
}: Props) {
  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:flex-row lg:items-center lg:justify-between"
      data-testid="team-cockpit-header-bar"
    >
      <TeamVisibilityControls
        teamId={teamId}
        websiteVisible={websiteVisible}
        infoboardVisible={infoboardVisible}
        canManage={canManage}
      />
    </div>
  );
}
