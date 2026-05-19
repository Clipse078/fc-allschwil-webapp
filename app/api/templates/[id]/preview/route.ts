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
import { resolveContext } from "@/lib/communication/context-resolver";
import { getActorContext } from "@/lib/visibility/get-actor-context";
import { requireTemplateAccess } from "@/lib/visibility/visibility-guards";

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
  const actor = await getActorContext(check.session.user);
  const guard = await requireTemplateAccess({ actor, id, access: "read" });
  if (!guard.ok) return guard.response;

  const template = await prisma.communicationTemplate.findUnique({
    where: { id },
    select: { id: true, subject: true, bodyMarkdown: true, moduleKey: true },
  });
  if (!template) return NextResponse.json({ error: "Vorlage nicht gefunden." }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  // Build context: start with sample, optionally replace with real entity data
  let entityContext: Record<string, string> = {};
  const resolveModuleKey = body?.moduleKey ?? template.moduleKey;
  const resolveEntityId = body?.entityId;
  if (resolveModuleKey && resolveEntityId) {
    entityContext = await resolveContext(resolveModuleKey, resolveEntityId);
  }

  const context: Record<string, string> = {
    ...buildSampleContext(),         // sample fallback for all vars
    ...entityContext,                 // real entity data (overrides sample)
    ...(typeof body?.context === "object" ? body.context : {}), // manual overrides
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
