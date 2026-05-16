import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Phone, ExternalLink, Lightbulb, Clock } from "lucide-react";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getDefaultSite } from "@/lib/news/queries";
import {
  getInquiryDetail,
  INQUIRY_TYPE_LABELS,
  INQUIRY_STATUS_LABELS,
} from "@/lib/website/inquiry-queries";
import {
  markInProgressAction,
  markResolvedAction,
  archiveInquiryAction,
} from "../actions";

type InquiryDetailPageProps = {
  params: Promise<{ inquiryId: string }>;
  searchParams?: Promise<{ status?: string }>;
};

const STATUS_TONES: Record<string, "success" | "muted" | "warning"> = {
  NEW: "warning",
  IN_PROGRESS: "warning",
  RESOLVED: "success",
  ARCHIVED: "muted",
};

type SmartSuggestion = { tone: "blue" | "amber" | "green"; text: string };

function getSmartSuggestions(
  type: string,
  status: string
): SmartSuggestion[] {
  const suggestions: SmartSuggestion[] = [];

  if (status === "NEW") {
    suggestions.push({
      tone: "amber",
      text: "Assign or answer this inquiry quickly — fast responses improve the club experience.",
    });
  }

  switch (type) {
    case "REGISTRATION_INTEREST":
      suggestions.push({
        tone: "blue",
        text: "This can later become a registration workflow when the workflow module is ready.",
      });
      break;
    case "SPONSOR_INTEREST":
      suggestions.push({
        tone: "blue",
        text: "Forward this to the person responsible for sponsoring partnerships.",
      });
      break;
    case "TRAINER_INTEREST":
      suggestions.push({
        tone: "blue",
        text: "Check current role needs and open positions before replying.",
      });
      break;
    case "VOLUNTEER_INTEREST":
      suggestions.push({
        tone: "green",
        text: "Assign to a department lead who can discuss volunteering opportunities.",
      });
      break;
  }

  return suggestions;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TONE_CLS: Record<string, string> = {
  blue: "border-blue-100 bg-blue-50/60",
  amber: "border-amber-200 bg-amber-50",
  green: "border-green-200 bg-green-50",
};
const TONE_TEXT: Record<string, string> = {
  blue: "text-blue-800",
  amber: "text-amber-800",
  green: "text-green-800",
};

const RETURN_PATH = "/dashboard/website/inquiries";

export default async function InquiryDetailPage({
  params,
  searchParams,
}: InquiryDetailPageProps) {
  await requireAnyPermission([
    PERMISSIONS.NEWS_MANAGE,
    PERMISSIONS.WEBSITE_MANAGE,
  ]);

  const { inquiryId } = await params;
  const { status } = (await searchParams) ?? {};

  const site = await getDefaultSite();
  if (!site) notFound();

  const inquiry = await getInquiryDetail(inquiryId, site.id);
  if (!inquiry) notFound();

  const suggestions = getSmartSuggestions(inquiry.type, inquiry.status);
  const isPublicPath = inquiry.sourcePath?.startsWith("/") ?? false;

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Website · Anfragen"
        title={inquiry.name}
        description={`${INQUIRY_TYPE_LABELS[inquiry.type] ?? inquiry.type} · Eingegangen ${formatDate(inquiry.createdAt)}`}
        actions={
          <Link href={RETURN_PATH} className="fca-button-secondary">
            Zurück
          </Link>
        }
      />

      {status === "updated" && (
        <AdminSurfaceCard className="border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">Status aktualisiert.</p>
        </AdminSurfaceCard>
      )}

      <AdminSurfaceCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <AdminStatusPill
              label={INQUIRY_STATUS_LABELS[inquiry.status] ?? inquiry.status}
              tone={STATUS_TONES[inquiry.status] ?? "muted"}
            />
            <span className="fca-pill">
              {INQUIRY_TYPE_LABELS[inquiry.type] ?? inquiry.type}
            </span>
            {inquiry.topic && <span className="fca-pill">{inquiry.topic}</span>}
            {inquiry.handledByUserId && (
              <span className="text-xs text-slate-400">
                Bearbeitet
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {inquiry.status === "NEW" && (
              <form action={markInProgressAction}>
                <input type="hidden" name="inquiryId" value={inquiry.id} />
                <input type="hidden" name="returnPath" value={`/dashboard/website/inquiries/${inquiry.id}`} />
                <button type="submit" className="fca-button-secondary">
                  In Bearbeitung
                </button>
              </form>
            )}
            {(inquiry.status === "NEW" || inquiry.status === "IN_PROGRESS") && (
              <form action={markResolvedAction}>
                <input type="hidden" name="inquiryId" value={inquiry.id} />
                <input type="hidden" name="returnPath" value={`/dashboard/website/inquiries/${inquiry.id}`} />
                <button type="submit" className="fca-button-primary">
                  Erledigt
                </button>
              </form>
            )}
            {inquiry.status !== "ARCHIVED" && (
              <form action={archiveInquiryAction}>
                <input type="hidden" name="inquiryId" value={inquiry.id} />
                <input type="hidden" name="returnPath" value={`/dashboard/website/inquiries/${inquiry.id}`} />
                <button
                  type="submit"
                  className="rounded-[20px] border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100"
                >
                  Archivieren
                </button>
              </form>
            )}
          </div>
        </div>
      </AdminSurfaceCard>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <AdminSurfaceCard className="p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Nachricht
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {inquiry.message}
            </p>
          </AdminSurfaceCard>

          {suggestions.length > 0 && (
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <AdminSurfaceCard
                  key={i}
                  className={`flex items-start gap-3 p-4 ${TONE_CLS[s.tone]}`}
                >
                  <Lightbulb className={`mt-0.5 h-4 w-4 shrink-0 ${TONE_TEXT[s.tone]}`} />
                  <p className={`text-sm ${TONE_TEXT[s.tone]}`}>{s.text}</p>
                </AdminSurfaceCard>
              ))}
            </div>
          )}

          <AdminSurfaceCard className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Zukünftige Aktionen
            </p>
            <div className="flex items-start gap-3">
              <button
                type="button"
                disabled
                title="Dieses Feature ist in Vorbereitung."
                className="cursor-not-allowed rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-400 opacity-50"
              >
                In Registrierungs-Ticket umwandeln
              </button>
              <p className="mt-1.5 text-xs text-slate-400">
                Workflow-Tickets sind in Vorbereitung.
              </p>
            </div>
          </AdminSurfaceCard>
        </div>

        <div className="space-y-4">
          <AdminSurfaceCard className="divide-y divide-slate-100 p-0 overflow-hidden">
            <div className="px-5 py-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Kontakt
              </p>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{inquiry.name}</p>
                </div>
                <a
                  href={`mailto:${inquiry.email}`}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  {inquiry.email}
                </a>
                {inquiry.phone && (
                  <a
                    href={`tel:${inquiry.phone}`}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                  >
                    <Phone className="h-4 w-4 shrink-0" />
                    {inquiry.phone}
                  </a>
                )}
              </div>
            </div>

            <div className="px-5 py-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Herkunft
              </p>
              {inquiry.sourcePath ? (
                isPublicPath ? (
                  <span className="text-xs font-mono text-slate-500">
                    {inquiry.sourcePath}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">{inquiry.sourcePath}</span>
                )
              ) : (
                <span className="text-xs text-slate-400 italic">Nicht verfügbar</span>
              )}
            </div>

            <div className="px-5 py-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Zeitstempel
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                {formatDate(inquiry.createdAt)}
              </div>
            </div>
          </AdminSurfaceCard>

          <AdminSurfaceCard className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Schnellaktionen
            </p>
            <div className="space-y-2">
              <a
                href={`mailto:${inquiry.email}?subject=Re: ${inquiry.topic ?? "Deine Anfrage"}`}
                className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                Per E-Mail antworten
              </a>
              {inquiry.phone && (
                <a
                  href={`tel:${inquiry.phone}`}
                  className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                  Anrufen
                </a>
              )}
            </div>
          </AdminSurfaceCard>
        </div>
      </div>
    </div>
  );
}
