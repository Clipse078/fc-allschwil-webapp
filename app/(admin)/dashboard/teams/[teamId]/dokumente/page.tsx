import TeamDocumentsView from "@/components/admin/teams/documents/TeamDocumentsView";
import { requireTeamCockpitAccess } from "@/lib/teams/team-cockpit-layout";
import { getTeamDocumentListItems } from "@/lib/teams/team-document-list";

type Props = {
  params: Promise<{ teamId: string }>;
};

export default async function TeamDokumentePage({ params }: Props) {
  const { teamId } = await params;
  const { tenantId } = await requireTeamCockpitAccess(teamId);
  const documents = await getTeamDocumentListItems(tenantId, teamId);

  return <TeamDocumentsView documents={documents} />;
}
