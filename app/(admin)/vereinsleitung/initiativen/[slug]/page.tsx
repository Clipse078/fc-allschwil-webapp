/**
 * Initiative detail page — legacy route at /vereinsleitung/initiativen/[slug].
 *
 * LEGACY BRIDGE:
 * Attempts to find a real Initiative whose title slugifies to the requested [slug].
 * If found → redirect to /initiatives/[id].
 * If not found → redirect to /initiatives list (no mock detail component exists
 * for Initiativen detail, unlike Meetings which had VereinsleitungMeetingDetail).
 *
 * TODO(decoupling): Once all legacy Vereinsleitung initiative links have been
 * replaced with canonical /initiatives/[id] links, this file can be removed.
 */

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { ACTIVE_TENANT_SLUG } from "@/lib/platform/constants";

type InitiativeDetailPageProps = {
  params: Promise<{ slug: string }>;
};

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default async function InitiativeDetailPage({ params }: InitiativeDetailPageProps) {
  const { slug } = await params;

  // ── Legacy bridge: look up real initiative by slugified title ────────────
  // TODO(multi-tenancy): replace ACTIVE_TENANT_SLUG with tenant from session
  try {
    const realInitiatives = await prisma.initiative.findMany({
      where: { tenantSlug: ACTIVE_TENANT_SLUG },
      select: { id: true, title: true },
      take: 200,
    });

    const match = realInitiatives.find(
      (i) => slugifyTitle(i.title) === slug.toLowerCase(),
    );

    if (match) {
      redirect(`/initiatives/${match.id}`);
    }
  } catch {
    // If DB lookup fails, fall through to list redirect.
  }

  // No match found — redirect to the initiatives list.
  // There is no legacy mock detail component for Initiativen (unlike Meetings).
  redirect("/initiatives");
}
