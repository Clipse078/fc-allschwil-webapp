"use client";

/**
 * WebsitePreviewDeviceSwitch
 *
 * Responsive device selector for the Website Preview Shell.
 * Provides Desktop / Tablet / Mobile viewport switching.
 * Pure UI — no data fetching.
 */

import { Monitor, Tablet, Smartphone } from "lucide-react";

export type PreviewDevice = "desktop" | "tablet" | "mobile";

export const PREVIEW_DEVICE_CONFIG: Record<
  PreviewDevice,
  { label: string; icon: React.ElementType; maxWidth: string }
> = {
  desktop: { label: "Desktop", icon: Monitor, maxWidth: "100%" },
  tablet: { label: "Tablet", icon: Tablet, maxWidth: "768px" },
  mobile: { label: "Mobile", icon: Smartphone, maxWidth: "390px" },
};

type Props = {
  device: PreviewDevice;
  onChange: (device: PreviewDevice) => void;
};

export default function WebsitePreviewDeviceSwitch({
  device,
  onChange,
}: Props) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
      {(["desktop", "tablet", "mobile"] as PreviewDevice[]).map((d) => {
        const { label, icon: Icon } = PREVIEW_DEVICE_CONFIG[d];
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition ${
              device === d
                ? "bg-white text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
            title={label}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
