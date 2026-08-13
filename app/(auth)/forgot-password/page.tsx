import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Passwort vergessen — SportClubEvo",
};

export default async function ForgotPasswordPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return <ForgotPasswordForm />;
}
