import { auth } from "@/auth";
import { redirect } from "next/navigation";
import VereinsleitungDashboard from "@/components/admin/vereinsleitung/VereinsleitungDashboard";
import { buildActorContext } from "@/lib/visibility/actor-context";
import { getTargets } from "@/lib/targets/queries";
import { getMeetings } from "@/lib/meetings/queries";

export default async function VereinsleitungPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const actor = buildActorContext(session.user);

  const [targets, meetings] = await Promise.all([
    getTargets(actor),
    getMeetings(actor),
  ]);

  return (
    <VereinsleitungDashboard
      targets={targets.slice(0, 3)}
      meetings={meetings.slice(0, 3)}
    />
  );
}
