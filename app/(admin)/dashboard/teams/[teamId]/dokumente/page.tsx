import TeamDocumentsView from "@/components/admin/teams/documents/TeamDocumentsView";
import { getTeamDocumentListItems } from "@/lib/teams/team-document-list";
import { requireTeamDocumentAccess } from "@/lib/teams/team-document-auth";

type Props = {
  params: Promise<{ teamId: string }>;
};

export default async function TeamDokumentePage({ params }: Props) {
  const { teamId } = await params;
  const access = await requireTeamDocumentAccess(teamId);
  const documents = await getTeamDocumentListItems(access.tenantId, teamId);

  return (
    <TeamDocumentsView
      teamId={teamId}
      documents={documents}
      canManageDocuments={access.canManageDocuments}
    />
  );
}
