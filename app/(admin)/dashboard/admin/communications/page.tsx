import { redirect } from "next/navigation";

export default async function CommunicationsSettingsPage() {
  redirect("/dashboard/communication/email-sender");
}
