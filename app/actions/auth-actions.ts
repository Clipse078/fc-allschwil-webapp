"use server";

import { signOut } from "@/auth";

/**
 * Server action for signing out.
 *
 * Uses the server-side signOut from @/auth (not next-auth/react) so that
 * the session cookie is cleared via Next.js cookies() API before the redirect
 * is issued. This avoids the race condition where the client-side fetch-based
 * signOut redirects to /login before the browser has committed the cleared
 * cookie, causing the login page's auth() check to still see a valid session
 * and bounce back to /dashboard.
 */
export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
