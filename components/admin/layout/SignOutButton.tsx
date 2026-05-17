import { signOutAction } from "@/app/actions/auth-actions";

type SignOutButtonProps = {
  collapsed?: boolean;
};

/**
 * Logout button that uses a server action form submission.
 *
 * A plain <form action={serverAction}> POST is used instead of the client-side
 * signOut from next-auth/react. The server action clears the session cookie
 * via Next.js cookies() before issuing the redirect, which prevents the
 * race-condition bounce (login page → auth() still sees old cookie → /dashboard).
 */
export default function SignOutButton({ collapsed = false }: SignOutButtonProps) {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        title={collapsed ? "Abmelden" : undefined}
        className={
          collapsed
            ? "w-full rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-xs font-semibold text-red-600 transition hover:bg-red-100 hover:text-red-700"
            : "w-full rounded-full border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 hover:text-red-700 shadow-sm"
        }
      >
        {collapsed ? "Logout" : "Abmelden"}
      </button>
    </form>
  );
}
