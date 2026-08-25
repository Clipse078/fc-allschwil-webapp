import { auth } from "@/auth";

/**
 * Lightweight API session gate for self-service endpoints that derive
 * authorization from user/person relationships rather than admin permissions.
 */
export async function requireApiSession() {
  const session = await auth();

  if (!session?.user) {
    return {
      ok: false as const,
      status: 401,
      error: "Unauthorized",
      session: null,
    };
  }

  return {
    ok: true as const,
    status: 200,
    error: null,
    session,
  };
}
