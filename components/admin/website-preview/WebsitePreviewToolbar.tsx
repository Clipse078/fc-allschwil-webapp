"use client";

/**
 * WebsitePreviewToolbar
 *
 * Top toolbar for the Website Preview Shell.
 * Shows page title, preview mode switch, device switch and close button.
 * Pure UI — no data fetching.
 */

import { Eye, X } from "lucide-react";
import WebsitePreviewModeSwitch, {
  type PreviewMode,
} from "./WebsitePreviewModeSwitch";
import WebsitePreviewDeviceSwitch, {
  type PreviewDevice,
} from "./WebsitePreviewDeviceSwitch";

type Props = {
  title: string;
  subtitle?: string;
  mode: PreviewMode;
  onModeChange: (mode: PreviewMode) => void;
  device: PreviewDevice;
  onDeviceChange: (device: PreviewDevice) => void;
  onClose: () => void;
};

export default function WebsitePreviewToolbar({
  title,
  subtitle,
  mode,
  onModeChange,
  device,
  onDeviceChange,
  onClose,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      {/* Title */}
      <div className="flex items-center gap-2 min-w-0">
        <Eye className="h-4 w-4 text-[var(--text-2)] shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{title}</p>
          {subtitle && (
            <p className="text-[11px] text-[var(--muted)] truncate">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 shrink-0">
        <WebsitePreviewModeSwitch mode={mode} onChange={onModeChange} />
        <WebsitePreviewDeviceSwitch device={device} onChange={onDeviceChange} />
        <button
          type="button"
          onClick={onClose}
          className="fca-button-secondary px-2.5"
          title="Vorschau schließen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
