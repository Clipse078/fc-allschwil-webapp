import Link from "next/link";
import { Inbox } from "lucide-react";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getDefaultSite } from "@/lib/news/queries";
import {
  getInquiryList,
  INQUIRY_TYPE_LABELS,
  INQUIRY_STATUS_LABELS,
} from "@/lib/website/inquiry-queries";
import {
  markInProgressAction,
  markResolvedAction,
  archiveInquiryAction,
} from "./actions";

type InquiriesPageProps = {
  searchParams?: Promise<{ status?: string; filter?: string }>;
};

const STATUS_FILTERS = [
  { value: "ALL", label: "Alle" },
  { value: "NEW", label: "Neu" },
  { value: "IN_PROGRESS", label: "In Bearbeitung" },
  { value: "RESOLVED", label: "Erledigt" },
  { value: "ARCHIVED", label: "Archiviert" },
];

const STATUS_TONES: Record<string, "success" | "muted" | "warning"> = {
  NEW: "warning",
  IN_PROGRESS: "warning",
  RESOLVED: "success",
  ARCHIVED: "muted",
};

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function InquiriesPage({ searchParams }: InquiriesPageProps) {
  await requireAnyPermission([
    PERMISSIONS.NEWS_MANAGE,
    PERMISSIONS.WEBSITE_MANAGE,
  ]);

  const params = (await searchParams) ?? {};
  const activeFilter = params.filter ?? "NEW";
  const showUpdateMsg = params.status === "updated";

  const site = await getDefaultSite();
  const inquiries = site
    ? await getInquiryList(site.id, activeFilter === "ALL" ? null : activeFilter)
    : [];

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Website · Anfragen"
        title="Anfragen & Interesse"
        description="Website-Kontaktanfragen und Interessensmeldungen aus der öffentlichen Website."
      />

      <AdminSurfaceCard className="border-blue-100 bg-blue-50/60 p-5">
        <div className="flex items-start gap-3">
          <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <p className="text-sm text-slate-700">
            <span className="font-semibold">Schnell antworten verbessert das Vereinserlebnis.</span>{" "}
            Neue Anfragen sollten innerhalb von 48 Stunden beantwortet werden.
          </p>
        </div>
      </AdminSurfaceCard>

      {showUpdateMsg && (
        <AdminSurfaceCard className="border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">Status aktualisiert.</p>
        </AdminSurfaceCard>
      )}

      {!site && (
        <AdminSurfaceCard className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-800">Kein aktiver Website-Eintrag gefunden.</p>
        </AdminSurfaceCard>
      )}

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const isActive = f.value === activeFilter;
          return (
            <Link
              key={f.value}
              href={`/dashboard/website/inquiries${f.value === "ALL" ? "?filter=ALL" : `?filter=${f.value}`}`}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                isActive
                  ? "bg-[#0b4aa2] text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {inquiries.length === 0 ? (
        <AdminSurfaceCard className="p-6">
          <p className="text-sm text-slate-500">Keine Anfragen für diesen Filter.</p>
        </AdminSurfaceCard>
      ) : (
        <div className="space-y-3">
          {inquiries.map((inquiry) => (
            <AdminSurfaceCard key={inquiry.id} className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminStatusPill
                      label={INQUIRY_STATUS_LABELS[inquiry.status] ?? inquiry.status}
                      tone={STATUS_TONES[inquiry.status] ?? "muted"}
                    />
                    <span className="fca-pill">
                      {INQUIRY_TYPE_LABELS[inquiry.type] ?? inquiry.type}
                    </span>
                    {inquiry.topic && (
                      <span className="fca-pill">{inquiry.topic}</span>
                    )}
                    <span className="text-xs text-slate-400">{formatDate(inquiry.createdAt)}</span>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {inquiry.name}
                    </p>
                    <p className="text-sm text-slate-500">
                      <a href={`mailto:${inquiry.email}`} className="hover:underline">
                        {inquiry.email}
                      </a>
                      {inquiry.phone && ` · ${inquiry.phone}`}
                    </p>
                  </div>

                  <p className="text-sm leading-relaxed text-slate-700">
                    {inquiry.message.length > 200
                      ? `${inquiry.message.slice(0, 200)}…`
                      : inquiry.message}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Link
                    href={`/dashboard/website/inquiries/${inquiry.id}`}
                    className="fca-button-secondary"
                  >
                    Detail
                  </Link>
                  {inquiry.status === "NEW" && (
                    <form action={markInProgressAction}>
                      <input type="hidden" name="inquiryId" value={inquiry.id} />
                      <input type="hidden" name="returnPath" value="/dashboard/website/inquiries" />
                      <button type="submit" className="fca-button-secondary">
                        In Bearbeitung
                      </button>
                    </form>
                  )}
                  {(inquiry.status === "NEW" || inquiry.status === "IN_PROGRESS") && (
                    <form action={markResolvedAction}>
                      <input type="hidden" name="inquiryId" value={inquiry.id} />
                      <input type="hidden" name="returnPath" value="/dashboard/website/inquiries" />
                      <button type="submit" className="fca-button-primary">
                        Erledigt
                      </button>
                    </form>
                  )}
                  {inquiry.status !== "ARCHIVED" && (
                    <form action={archiveInquiryAction}>
                      <input type="hidden" name="inquiryId" value={inquiry.id} />
                      <input type="hidden" name="returnPath" value="/dashboard/website/inquiries" />
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
          ))}
        </div>
      )}
    </div>
  );
}
