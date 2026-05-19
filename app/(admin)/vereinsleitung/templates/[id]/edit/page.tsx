import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default async function VereinsleitungTemplateEditRedirect({ params }: PageProps) {
  const { id } = await params;
  redirect(`/templates/${id}/edit`);
}
