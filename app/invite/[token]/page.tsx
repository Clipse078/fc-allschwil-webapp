import InviteAcceptForm from "@/components/auth/InviteAcceptForm";

type InvitePageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  return <InviteAcceptForm token={token} />;
}