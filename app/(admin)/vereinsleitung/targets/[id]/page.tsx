import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default async function VereinsleitungTargetDetailRedirect({ params }: PageProps) {
  const { id } = await params;
  redirect(`/targets/${id}`);
}
