import { redirect } from "next/navigation";

/**
 * /infoboard — Compatibility redirect to the canonical Screen 1 route.
 *
 * The legacy rotating display has been replaced by the new Publishing Platform
 * Screen 1. This server-side redirect forwards all /infoboard requests to the
 * canonical production route without any client-side flash, polling, or legacy
 * feed call. Query parameters (e.g. ?date=) are intentionally dropped — the
 * public Screen 1 always uses the real current date.
 */
export default function InfoboardPage() {
  redirect("/infoboard/screen-1");
}
