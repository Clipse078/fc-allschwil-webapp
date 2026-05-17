import { auth } from "@/auth";
import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";

// Never cache the login page — must always re-validate session server-side.
// This prevents stale RSC payloads from sending an already-logged-out user
// back to /dashboard after a successful sign-out.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return <LoginForm />;
}
