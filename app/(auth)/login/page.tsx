import { auth } from "@/auth";
import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";

// Never cache the login page — must always re-validate session server-side.
// Prevents stale RSC payloads from bouncing a freshly logged-out user back
// to /dashboard before the session cookie has propagated.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return <LoginForm />;
}