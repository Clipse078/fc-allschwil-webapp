import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default async function VereinsleitungTemplateDetailRedirect({ params }: PageProps) {
  const { id } = await params;
  redirect(`/templates/${id}`);
}
