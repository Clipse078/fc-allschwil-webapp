/**
 * Meetings list page — currently under /vereinsleitung/meetings.
 *
 * TODO(decoupling — Meetings Module):
 * Meetings must become a standalone reusable module, not a child of Vereinsleitung.
 * Target route: /meetings (with optional ?orgUnit=... filter for context)
 * Migration steps:
 *   1. Create app/(admin)/meetings/page.tsx using the future MeetingsList component
 *   2. Replace static mock data with real Prisma queries (Meeting model not yet in schema)
 *   3. Add orgUnitId / targetGroup as query param or route context
 *   4. Add Next.js redirect: /vereinsleitung/meetings → /meetings (with orgUnit param)
 *   5. Deprecate this route file once redirect is live
 *
 * Blocker: Meeting data model not yet in Prisma schema. Route migration pending.
 */
import VereinsleitungMeetingsList from "@/components/admin/vereinsleitung/VereinsleitungMeetingsList";

export default function VereinsleitungMeetingsPage() {
  return <VereinsleitungMeetingsList />;
}
