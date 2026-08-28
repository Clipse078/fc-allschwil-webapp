import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import TeamCockpitNav from "@/components/admin/teams/TeamCockpitNav";
import TeamCockpitVisibilityBar from "@/components/admin/teams/TeamCockpitVisibilityBar";
import {
  buildTeamCockpitDisplayTitle,
  buildTeamCockpitMetaLine,
  requireTeamCockpitAccess,
} from "@/lib/teams/team-cockpit-layout";
import { PageShell } from "@/components/ui/page";
import { DetailPagePattern } from "@/components/ui/patterns";
import { Badge } from "@/components/ui";

type LayoutProps = {
  children: ReactNode;
  params: Promise<{ teamId: string }>;
};

/**
 * TEAM-COCKPIT-PREMIUM-01D: shared Team Cockpit workspace shell.
 * Authorization and tenant-scoped team lookup run here so nested routes
 * inherit the same boundary without bypassing access checks.
 */
export default async function TeamCockpitLayout({
  children,
  params,
}: LayoutProps) {
  const { teamId } = await params;
  const { team, canManage, canDelete } = await requireTeamCockpitAccess(teamId);

  const displayTitle = buildTeamCockpitDisplayTitle(team);

  return (
    <PageShell fullWidth>
      <DetailPagePattern
        eyebrow="Teams"
        title={displayTitle}
        description={buildTeamCockpitMetaLine(team)}
        headerBadge={
          <Badge variant={team.isActive ? "success" : "outline"}>
            {team.isActive ? "Aktiv" : "Archiviert"}
          </Badge>
        }
        breadcrumbs={[
          { label: "Teams", href: "/dashboard/teams" },
          { label: displayTitle },
        ]}
        headerActions={
          <Link
            href="/dashboard/teams"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-sm font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Zurück zu Teams
          </Link>
        }
        summary={
          <div className="space-y-4">
            <TeamCockpitVisibilityBar
              teamId={team.id}
              websiteVisible={team.websiteVisible}
              infoboardVisible={team.infoboardVisible}
              canManage={canManage}
            />
            <TeamCockpitNav
              teamId={team.id}
              canManage={canManage}
              canDelete={canDelete}
            />
          </div>
        }
      >
        {children}
      </DetailPagePattern>
    </PageShell>
  );
}
