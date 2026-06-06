import { notFound, redirect } from "next/navigation";

/**
 * /dashboard/website/news/[id] — redirect to the edit page.
 * The canonical edit URL is /dashboard/website/news/[id]/edit.
 */
export default async function NewsArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) notFound();
  redirect(`/dashboard/website/news/${id}/edit`);
}
