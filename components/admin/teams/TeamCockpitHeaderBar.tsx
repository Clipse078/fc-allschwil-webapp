"use client";

import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import TeamVisibilityControls from "@/components/admin/teams/TeamVisibilityControls";

type Props = {
  teamId: string;
  websiteVisible: boolean;
  infoboardVisible: boolean;
  canManage: boolean;
  isEditingSettings: boolean;
  onEditSettings: () => void;
  onCancelEditSettings: () => void;
  onVisibilityChange?: (values: {
    websiteVisible: boolean;
    infoboardVisible: boolean;
  }) => void;
};

/**
 * TEAM-COCKPIT-01D: top-of-page operational controls — visibility + settings edit entry.
 */
export default function TeamCockpitHeaderBar({
  teamId,
  websiteVisible,
  infoboardVisible,
  canManage,
  isEditingSettings,
  onEditSettings,
  onCancelEditSettings,
  onVisibilityChange,
}: Props) {
  return (
    <div
      className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:flex-row lg:items-center lg:justify-between"
      data-testid="team-cockpit-header-bar"
    >
      <TeamVisibilityControls
        teamId={teamId}
        websiteVisible={websiteVisible}
        infoboardVisible={infoboardVisible}
        canManage={canManage}
        onVisibilityChange={onVisibilityChange}
      />

      {canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          {isEditingSettings ? (
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<X className="h-3.5 w-3.5" />}
              onClick={onCancelEditSettings}
            >
              Bearbeiten beenden
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<Pencil className="h-3.5 w-3.5" />}
              onClick={onEditSettings}
              data-testid="team-settings-edit-button"
            >
              Bearbeiten
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
