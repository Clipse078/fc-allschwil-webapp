import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import {
  CommunicationTemplateCategory,
  CommunicationTemplateStatus,
  VisibilityScope,
} from "@prisma/client";

async function requireSession() {
  const session = await auth();
  if (!session?.user) return { ok: false as const, status: 401, error: "Unauthorized" };
  return { ok: true as const, session };
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const { id } = await params;
  const template = await prisma.communicationTemplate.findUnique({ where: { id } });
  if (!template) return NextResponse.json({ error: "Vorlage nicht gefunden." }, { status: 404 });
  return NextResponse.json({ template });
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const { id } = await params;
  const existing = await prisma.communicationTemplate.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Vorlage nicht gefunden." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const validCategories = Object.values(CommunicationTemplateCategory);
  const validStatuses = Object.values(CommunicationTemplateStatus);
  const validScopes = Object.values(VisibilityScope);

  try {
    const updated = await prisma.communicationTemplate.update({
      where: { id },
      data: {
        title: body?.title?.trim() || undefined,
        subject: body?.subject?.trim() || undefined,
        bodyMarkdown: body?.bodyMarkdown?.trim() || undefined,
        moduleKey: body?.moduleKey?.trim() || null,
        category: validCategories.includes(body?.category) ? body.category : undefined,
        status: validStatuses.includes(body?.status) ? body.status : undefined,
        visibilityScope: validScopes.includes(body?.visibilityScope) ? body.visibilityScope : undefined,
      },
      select: { id: true, slug: true, title: true },
    });
    return NextResponse.json({ template: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Vorlage konnte nicht aktualisiert werden." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const { id } = await params;
  const existing = await prisma.communicationTemplate.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Vorlage nicht gefunden." }, { status: 404 });
  await prisma.communicationTemplate.delete({ where: { id } });
  return NextResponse.json({ message: "Vorlage gelöscht." });
}
