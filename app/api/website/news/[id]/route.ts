/**
 * /api/website/news/[id]
 *
 * GET    — get a single news post (admin view, includes drafts)
 * PATCH  — update fields of a news post
 * DELETE — delete a news post
 *
 * Permission: WEBSITE_MANAGE or NEWS_MANAGE
 * Tenant isolation: post must belong to actor's tenant
 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getNewsPostByIdForAdmin,
  updateNewsPost,
  deleteNewsPost,
} from "@/lib/website/news-queries";

type RouteParams = { params: Promise<{ id: string }> };

const ALLOWED = [PERMISSIONS.WEBSITE_MANAGE, PERMISSIONS.NEWS_MANAGE];

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const access = await requireApiAnyPermission(ALLOWED);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenantId = access.session?.user?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Kein Tenant zugeordnet." }, { status: 403 });

  const { id } = await params;
  const post = await getNewsPostByIdForAdmin(tenantId, id);
  if (!post) return NextResponse.json({ error: "Artikel nicht gefunden." }, { status: 404 });

  return NextResponse.json({ post });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const access = await requireApiAnyPermission(ALLOWED);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenantId = access.session?.user?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Kein Tenant zugeordnet." }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { title, slug, excerpt, bodyContent, coverImageUrl, authorName, isPublished } = body;

  try {
    const updated = await updateNewsPost(tenantId, id, {
      ...(title !== undefined && { title: typeof title === "string" ? title.trim() : title }),
      ...(slug !== undefined && {
        slug: typeof slug === "string" ? slug.trim().toLowerCase() : slug,
      }),
      ...(excerpt !== undefined && { excerpt }),
      ...(bodyContent !== undefined && { body: bodyContent }),
      ...(coverImageUrl !== undefined && { coverImageUrl }),
      ...(authorName !== undefined && { authorName }),
      ...(isPublished !== undefined && { isPublished }),
    });

    if (!updated) {
      return NextResponse.json({ error: "Artikel nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json({ post: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return NextResponse.json(
        { error: "Ein Artikel mit diesem Slug existiert bereits." },
        { status: 409 },
      );
    }
    throw err;
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const access = await requireApiAnyPermission(ALLOWED);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenantId = access.session?.user?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Kein Tenant zugeordnet." }, { status: 403 });

  const { id } = await params;
  const deleted = await deleteNewsPost(tenantId, id);
  if (!deleted) {
    return NextResponse.json({ error: "Artikel nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
