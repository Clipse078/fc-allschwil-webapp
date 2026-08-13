import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Neues Passwort wählen — SportClubEvo",
};

export default async function ResetPasswordPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return <ResetPasswordForm />;
}
