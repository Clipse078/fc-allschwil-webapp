import { notFound } from "next/navigation";
import { EmailThreadTimeline } from "@/components/admin/communications/EmailCommunicationPanel";

export const dynamic = "force-dynamic";

export default function Comm02EmailThreadPreviewPage() {
  // Dev-only preview surface for COMM-02 UI verification.
  if ((process.env.APP_ENV ?? "local").trim().toLowerCase() !== "local") {
    notFound();
  }

  const messages = [
    {
      id: "inbound-1",
      direction: "INBOUND" as const,
      subject: "Re: Anmeldung Probetraining",
      body: "Hallo!\n\nDanke für die Info. Passt für uns.\n\nBeste Grüsse\nAnna",
      from: "Anna Muster <anna@example.com>",
      to: "reply+<token>@inbound.example.com",
      status: "RECEIVED" as const,
      senderDisplayName: null,
      sentAt: null,
      receivedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      deliveryError: null,
      attachmentCount: 0,
    },
    {
      id: "outbound-1",
      direction: "OUTBOUND" as const,
      subject: "Anmeldung Probetraining",
      body: "Hallo Anna,\n\nDanke für deine Anmeldung. Wir melden uns zeitnah.\n\nSportliche Grüsse\nFC Allschwil",
      from: null,
      to: "anna@example.com",
      status: "SENT" as const,
      senderDisplayName: "Club Admin",
      sentAt: new Date().toISOString(),
      receivedAt: null,
      createdAt: new Date().toISOString(),
      deliveryError: null,
      attachmentCount: 1,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-lg font-semibold text-[var(--foreground)]">COMM-02 — E-Mail-Thread Vorschau</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Dev-only Preview: Inbound + Outbound Messages im selben Verlauf.
      </p>

      <div className="mt-6">
        <EmailThreadTimeline messages={messages} locale="de-CH" timezone="Europe/Zurich" />
      </div>
    </div>
  );
}
