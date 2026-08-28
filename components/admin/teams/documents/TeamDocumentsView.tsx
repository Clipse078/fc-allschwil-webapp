import TeamDocumentsClientShell from "@/components/admin/teams/documents/TeamDocumentsClientShell";
import type { TeamDocumentListItem } from "@/lib/teams/team-document-list";

type Props = {
  teamId: string;
  documents: TeamDocumentListItem[];
  canManageDocuments: boolean;
};

/**
 * TEAM-COCKPIT-PREMIUM-01J-C — team document workspace entry point.
 */
export default function TeamDocumentsView({
  teamId,
  documents,
  canManageDocuments,
}: Props) {
  return (
    <TeamDocumentsClientShell
      teamId={teamId}
      documents={documents}
      canManageDocuments={canManageDocuments}
    />
  );
}
