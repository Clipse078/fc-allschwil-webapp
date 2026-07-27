import { redirect } from "next/navigation";

/**
 * /dashboard/teams/new — retired entry point.
 *
 * The legacy TeamCreateForm allowed optional OrgUnit and bypassed the
 * mandatory OrgUnit requirement enforced by the canonical registration service.
 *
 * TEAM-CREATE-01: All normal user-facing Team creation now goes through the
 * premium registration wizard at /dashboard/teams/register, which enforces
 * all product rules via registerTeamSeason() and writeTeamSeasonInTx().
 *
 * This redirect preserves any bookmarks or old links without exposing the
 * old weaker creation path.
 */
export default function NewTeamPageRedirect() {
  redirect("/dashboard/teams/register");
}
