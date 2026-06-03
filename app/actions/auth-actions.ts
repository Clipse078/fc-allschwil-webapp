"use server";

/**
 * Server action for signing out.
 *
 * Uses the server-side signOut from @/auth (NextAuth v5) with redirectTo,
 * which resolves the redirect against the current request Host header
 * (trustHost: true) rather than NEXTAUTH_URL. This prevents stale
 * NEXTAUTH_URL environment variables from sending the user to an old domain.
 *
 * This replaces the client-side signOut({ callbackUrl }) approach from
 * next-auth/react, which relied on the server resolving callbackUrl against
 * NEXTAUTH_URL before returning the redirect URL to the browser.
 */
import { signOut } from "@/auth";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
