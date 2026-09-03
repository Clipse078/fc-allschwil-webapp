"use server";

/**
 * Server action for signing out.
 *
 * Invalidates the JWT session cookie via Auth.js signOut with redirect disabled,
 * so navigation can be completed by the client with a hard same-origin load of
 * /login. This avoids soft RSC transitions that can leave stale authenticated
 * shell UI in place after logout.
 */
import { signOut } from "@/auth";

export async function signOutAction() {
  await signOut({ redirect: false, redirectTo: "/login" });
}
