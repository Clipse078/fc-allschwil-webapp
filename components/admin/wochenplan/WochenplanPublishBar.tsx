"use client";

import { useState } from "react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

type WochenplanPublishBarProps = {
  hasUnsavedChanges: boolean;
  events: Array<{
    id: string;
    startAt: Date | string;
    endAt: Date | string | null;
    eventType: string;
    pitchRowKey: string;
    fieldLabel: "A" | "B" | null;
  }>;
  onPublished: () => void;
};

function ChannelBadge({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <div
      className={[
        "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
        active
          ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
          : "bg-slate-100 text-slate-500 border border-slate-200",
      ].join(" ")}
    >
      {label}
    </div>
  );
}

export default function WochenplanPublishBar({
  hasUnsavedChanges,
  events,
  onPublished,
}: WochenplanPublishBarProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function publishChanges(action: "submit" | "publish") {
    if (!hasUnsavedChanges || events.length === 0 || isPublishing) {
      return;
    }

    setIsPublishing(true);
    setMessage(null);

    const response = await fetch("/api/wochenplan/publish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        events: events.map((event) => ({
          id: event.id,
          startAt: event.startAt,
          endAt: event.endAt,
          eventType: event.eventType,
          pitchRowKey: event.pitchRowKey,
          fieldLabel: event.fieldLabel,
        })),
      }),
    });

    setIsPublishing(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setMessage(payload?.error ?? "Publizieren fehlgeschlagen.");
      return;
    }

    const payload = await response.json().catch(() => null);
    setMessage(
      action === "submit"
        ? `${payload?.publishedCount ?? events.length} Einträge zur Freigabe eingereicht.`
        : `${payload?.publishedCount ?? events.length} Einträge publiziert.`,
    );
    onPublished();
  }
  return (
    <AdminSurfaceCard className="p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        
        {/* LEFT: Context */}
        <div>
          <p className="fca-eyebrow">Publishing</p>
          <h3 className="fca-subheading mt-2">
            Zielsysteme & Veröffentlichung
          </h3>

          <div className="mt-3 flex flex-wrap gap-2">
            <ChannelBadge label="Website" active={true} />
            <ChannelBadge label="Infoboard" active={true} />
            <ChannelBadge label="Mobile App" active={false} />
          </div>
        </div>

        {/* RIGHT: Actions */}
        <div className="flex flex-col items-start gap-3 xl:items-end">
          <div className="text-xs text-slate-500">
            {message ?? (hasUnsavedChanges
              ? "Änderungen bereit zur Veröffentlichung"
              : "Keine neuen Änderungen")}
          </div>

          <button
            type="button"
            onClick={() => publishChanges("submit")}
            disabled={!hasUnsavedChanges || isPublishing}
            className={[
              "rounded-full border px-6 py-3 text-sm font-semibold transition",
              hasUnsavedChanges && !isPublishing
                ? "border-red-200 bg-white text-red-600 hover:bg-red-50 hover:text-red-700 btn-glow btn-glow-red"
                : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
            ].join(" ")}
          >
            {isPublishing ? "Senden..." : "Änderungen einreichen"}
          </button>

          <button
            type="button"
            onClick={() => publishChanges("publish")}
            disabled={!hasUnsavedChanges || isPublishing}
            className={[
              "rounded-full border px-6 py-3 text-sm font-semibold transition",
              hasUnsavedChanges && !isPublishing
                ? "border-blue-200 bg-[#0b4aa2] text-white hover:bg-[#083a7d]"
                : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
            ].join(" ")}
          >
            {isPublishing ? "Publizieren..." : "Freigeben & publizieren"}
          </button>
        </div>
      </div>
    </AdminSurfaceCard>
  );
}



