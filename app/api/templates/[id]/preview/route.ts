/**
 * POST /api/templates/[id]/preview
 *
 * Renders a template with a supplied context (or sample context) and returns
 * the substituted subject + body. No sending — pure deterministic rendering.
 *
 * This is Layer 2 of the Communication Foundation. Layer 3 (delivery) is future.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { renderTemplate, buildSampleContext, extractVariableKeys } from "@/lib/communication/variables";

async function requireSession() {
  const session = await auth();
  if (!session?.user) return { ok: false as const, status: 401, error: "Unauthorized" };
  return { ok: true as const, session };
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const { id } = await params;
  const template = await prisma.communicationTemplate.findUnique({
    where: { id },
    select: { id: true, subject: true, bodyMarkdown: true },
  });
  if (!template) return NextResponse.json({ error: "Vorlage nicht gefunden." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const context: Record<string, string> = {
    ...buildSampleContext(),
    ...(typeof body?.context === "object" ? body.context : {}),
  };

  const renderedSubject = renderTemplate(template.subject, context);
  const renderedBody = renderTemplate(template.bodyMarkdown, context);
  const usedKeys = extractVariableKeys(template.subject + "\n" + template.bodyMarkdown);
  const unresolvedKeys = usedKeys.filter((k) => !context[k]);

  return NextResponse.json({
    renderedSubject,
    renderedBody,
    usedVariables: usedKeys,
    unresolvedVariables: unresolvedKeys,
  });
}
