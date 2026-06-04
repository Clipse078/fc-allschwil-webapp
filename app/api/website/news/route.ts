/**
 * /api/website/news
 *
 * GET  — list all news posts for the actor's tenant (published + drafts)
 * POST — create a new news post
 *
 * Permission: WEBSITE_MANAGE or NEWS_MANAGE
 * Tenant isolation: tenantId derived from session.user.tenantId
 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getNewsPostsForAdmin,
  createNewsPost,
  generateNewsSlug,
} from "@/lib/website/news-queries";

const ALLOWED = [PERMISSIONS.WEBSITE_MANAGE, PERMISSIONS.NEWS_MANAGE];

export async function GET() {
  const access = await requireApiAnyPermission(ALLOWED);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenantId = access.session?.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Tenant zugeordnet." }, { status: 403 });
  }

  const posts = await getNewsPostsForAdmin(tenantId);
  return NextResponse.json({ posts });
}

export async function POST(req: NextRequest) {
  const access = await requireApiAnyPermission(ALLOWED);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenantId = access.session?.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Tenant zugeordnet." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    title,
    slug: rawSlug,
    excerpt,
    bodyContent,
    coverImageUrl,
    authorName,
    isPublished,
  } = body;

  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Titel ist erforderlich." }, { status: 400 });
  }

  const slug =
    typeof rawSlug === "string" && rawSlug.trim()
      ? rawSlug.trim().toLowerCase()
      : generateNewsSlug(title);

  try {
    const post = await createNewsPost({
      tenantId,
      slug,
      title: title.trim(),
      excerpt: typeof excerpt === "string" ? excerpt.trim() || null : null,
      body: typeof bodyContent === "string" ? bodyContent : "",
      coverImageUrl: typeof coverImageUrl === "string" ? coverImageUrl.trim() || null : null,
      authorName: typeof authorName === "string" ? authorName.trim() || null : null,
      isPublished: isPublished === true,
    });
    return NextResponse.json({ post }, { status: 201 });
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
