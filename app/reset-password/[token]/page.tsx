import PasswordResetForm from "@/components/auth/PasswordResetForm";

type ResetPasswordPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function ResetPasswordPage({ params }: ResetPasswordPageProps) {
  const { token } = await params;

  return <PasswordResetForm token={token} />;
}