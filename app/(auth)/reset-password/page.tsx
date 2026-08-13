import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Neues Passwort wählen — SportClubEvo",
};

// Authenticated users are NOT redirected away from this page.
// The reset token must be validated regardless of session state so that
// consumed/expired tokens correctly show the "Link ungültig" error state.
export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
