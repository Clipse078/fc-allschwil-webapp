import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import {
  CommunicationTemplateCategory,
  CommunicationTemplateStatus,
  VisibilityScope,
} from "@prisma/client";
import { getCommunicationTemplates } from "@/lib/communication/queries";
import { getActorContext } from "@/lib/visibility/get-actor-context";

async function requireSession() {
  const session = await auth();
  if (!session?.user) return { ok: false as const, status: 401, error: "Unauthorized" };
  return { ok: true as const, session };
}

export async function GET() {
  const check = await requireSession();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const actor = await getActorContext(check.session.user);

  // Templates permission check for listing
  if (!actor.permissionKeys.includes("templates.view") && !actor.permissionKeys.includes("templates.manage")) {
    return NextResponse.json({ error: "templates.view Berechtigung erforderlich." }, { status: 403 });
  }

  // Visibility filter: ORGANISATION + own PRIVATE/RESTRICTED
  const templates = await getCommunicationTemplates(actor.userId);
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const check = await requireSession();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const body = await req.json().catch(() => ({}));
  const title = (body?.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Titel ist erforderlich." }, { status: 400 });
  const subject = (body?.subject ?? "").trim();
  if (!subject) return NextResponse.json({ error: "Betreff ist erforderlich." }, { status: 400 });
  const bodyMarkdown = (body?.bodyMarkdown ?? "").trim();
  if (!bodyMarkdown) return NextResponse.json({ error: "Inhalt ist erforderlich." }, { status: 400 });

  const rawSlug = (body?.slug ?? "").trim();
  const slug = rawSlug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const existing = await prisma.communicationTemplate.findUnique({ where: { slug }, select: { id: true } });
  if (existing) return NextResponse.json({ error: `Slug "${slug}" ist bereits vergeben.` }, { status: 409 });

  const validCategories = Object.values(CommunicationTemplateCategory);
  const category: CommunicationTemplateCategory = validCategories.includes(body?.category)
    ? body.category : CommunicationTemplateCategory.GENERAL;

  const validScopes = Object.values(VisibilityScope);
  const visibilityScope: VisibilityScope = validScopes.includes(body?.visibilityScope)
    ? body.visibilityScope : VisibilityScope.ORGANISATION;

  try {
    const template = await prisma.communicationTemplate.create({
      data: {
        slug, title, subject, bodyMarkdown, category,
        moduleKey: body?.moduleKey?.trim() || null,
        visibilityScope,
        createdByUserId: check.session.user.id,
        status: CommunicationTemplateStatus.DRAFT,
      },
      select: { id: true, slug: true, title: true },
    });
    return NextResponse.json({ template }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Vorlage konnte nicht erstellt werden." }, { status: 500 });
  }
}
