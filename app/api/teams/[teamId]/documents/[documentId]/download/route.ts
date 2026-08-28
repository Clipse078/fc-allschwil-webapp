/**
 * TEAM-COCKPIT-PREMIUM-01J-C — GET /api/teams/[teamId]/documents/[documentId]/download
 *
 * Server-side streaming download for a TeamDocument.
 *
 * Security guarantees:
 *   - Authenticated session required.
 *   - Active tenant context required.
 *   - Team must belong to that tenant.
 *   - Requires team-specific document view access (independent of page access).
 *   - Document must belong to that team + tenant.
 *   - The raw storage key/URL is NEVER returned to the client.
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireApiTeamDocumentAccess } from "@/lib/teams/team-document-auth";
import {
  downloadTeamDocument,
  TeamDocumentServiceError,
} from "@/lib/teams/team-document-service";

type RouteContext = { params: Promise<{ teamId: string; documentId: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const { teamId, documentId } = await params;
  const access = await requireApiTeamDocumentAccess(teamId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const result = await downloadTeamDocument({
      tenantId: access.access.tenantId,
      teamId,
      documentId,
    });

    return new Response(result.stream, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(result.filename)}"`,
        "Content-Length": String(result.sizeBytes),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    if (err instanceof TeamDocumentServiceError) {
      const status = err.code === "DOCUMENT_NOT_FOUND" ? 404 : 503;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    throw err;
  }
}
