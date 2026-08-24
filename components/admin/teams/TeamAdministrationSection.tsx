import TeamLifecycleCard from "@/components/admin/teams/TeamLifecycleCard";
import TeamSeasonDeleteButton from "@/components/admin/teams/TeamSeasonDeleteButton";
import { SectionCard } from "@/components/ui/page";

type TeamSeasonSummary = {
  id: string;
  displayName: string;
  season: { name: string };
};

type Props = {
  teamId: string;
  teamName: string;
  isActive: boolean;
  canManage: boolean;
  canDelete: boolean;
  teamSeasons: TeamSeasonSummary[];
};

/**
 * TEAM-COCKPIT-01D: de-emphasized administration — lifecycle and season delete
 * grouped at the bottom of the cockpit instead of the primary sidebar.
 */
export default function TeamAdministrationSection({
  teamId,
  teamName,
  isActive,
  canManage,
  canDelete,
  teamSeasons,
}: Props) {
  if (!canManage && !canDelete) {
    return null;
  }

  return (
    <div className="space-y-4" data-testid="team-administration-section">
      <div className="border-t border-[var(--border)] pt-6">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Administration</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Archivierung, Wiederherstellung und dauerhaftes Löschen.
        </p>
      </div>

      <TeamLifecycleCard
        teamId={teamId}
        teamName={teamName}
        isActive={isActive}
        canManage={canManage}
        canDelete={canDelete}
      />

      {canDelete && teamSeasons.length > 0 ? (
        <SectionCard title="Saisonen verwalten" description="Dauerhaftes Löschen einzelner Team-Saisons.">
          <div className="space-y-2">
            {teamSeasons.map((teamSeason) => (
              <div
                key={teamSeason.id}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">
                    {teamSeason.displayName}
                  </p>
                  <p className="text-xs text-[var(--muted)]">{teamSeason.season.name}</p>
                </div>
                <TeamSeasonDeleteButton
                  teamId={teamId}
                  teamSeasonId={teamSeason.id}
                  teamSeasonName={teamSeason.displayName}
                />
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
