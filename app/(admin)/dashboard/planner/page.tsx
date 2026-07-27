import { redirect } from "next/navigation";

/**
 * The former Saisonplanung hub is now retired from primary navigation.
 * Training-series management lives in the dedicated Training Planner.
 * This redirect preserves the old URL for bookmarks and direct links.
 */
export default function PlannerRedirectPage() {
  redirect("/dashboard/training");
}
