import TeamDocumentsView from "@/components/admin/teams/documents/TeamDocumentsView";
import { getTeamDocumentListItems } from "@/lib/teams/team-document-list";
import { requireTeamDocumentAccess } from "@/lib/teams/team-document-auth";

type Props = {
  params: Promise<{ teamId: string }>;
};

export default async function TeamDokumentePage({ params }: Props) {
  const { teamId } = await params;
  const { tenantId } = await requireTeamDocumentAccess(teamId);
  const documents = await getTeamDocumentListItems(tenantId, teamId);

  return <TeamDocumentsView documents={documents} />;
}
