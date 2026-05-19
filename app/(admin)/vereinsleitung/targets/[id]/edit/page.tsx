import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default async function VereinsleitungTargetEditRedirect({ params }: PageProps) {
  const { id } = await params;
  redirect(`/targets/${id}/edit`);
}
