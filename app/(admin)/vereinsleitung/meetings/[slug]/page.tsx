/**
 * Meeting detail page — currently at /vereinsleitung/meetings/[slug].
 *
 * LEGACY BRIDGE:
 * This page now first attempts to find a real Meeting record whose title
 * slugifies to the requested [slug]. If found, it redirects to the canonical
 * /meetings/[id] route. If not found, it renders the existing mock component
 * so old bookmark links do not break.
 *
 * TODO(decoupling — Meetings Module):
 * Once all mock slugs have corresponding real meetings, this file can be
 * simplified to just: `redirect("/meetings")` as a catch-all fallback.
 * The [slug] routing will be fully replaced by /meetings/[id] (cuid-based).
 */

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { ACTIVE_TENANT_SLUG } from "@/lib/platform/constants";
import VereinsleitungMeetingDetail from "@/components/admin/vereinsleitung/VereinsleitungMeetingDetail";

type MeetingDetailPageProps = {
  params: Promise<{ slug: string }>;
};

/**
 * Converts a meeting title to a URL-friendly slug for comparison with the
 * [slug] route parameter. Handles common German characters.
 */
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

export default async function MeetingDetailPage({ params }: MeetingDetailPageProps) {
  const { slug } = await params;

  // ── Legacy bridge: look up real meeting by slugified title ──────────────
  // TODO(multi-tenancy): replace ACTIVE_TENANT_SLUG with tenant from session
  try {
    const realMeetings = await prisma.meeting.findMany({
      where: { tenantSlug: ACTIVE_TENANT_SLUG },
      select: { id: true, title: true },
      take: 200,
    });

    const match = realMeetings.find(
      (m) => slugifyTitle(m.title) === slug.toLowerCase(),
    );

    if (match) {
      redirect(`/meetings/${match.id}`);
    }
  } catch {
    // If DB lookup fails (e.g. during build), fall through to mock component.
  }

  // ── No match found — render legacy mock component ───────────────────────
  return <VereinsleitungMeetingDetail slug={slug} />;
}
