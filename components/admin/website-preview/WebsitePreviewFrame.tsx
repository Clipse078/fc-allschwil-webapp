"use client";

/**
 * WebsitePreviewFrame
 *
 * Responsive viewport frame for the Website Preview Shell.
 * Constrains content to the selected device width with smooth transitions.
 * Pure layout — no data fetching.
 */

import { PREVIEW_DEVICE_CONFIG, type PreviewDevice } from "./WebsitePreviewDeviceSwitch";

type Props = {
  device: PreviewDevice;
  children: React.ReactNode;
};

export default function WebsitePreviewFrame({ device, children }: Props) {
  const { maxWidth } = PREVIEW_DEVICE_CONFIG[device];
  return (
    <div className="flex-1 overflow-auto bg-[var(--surface-2)] p-6">
      <div
        className="mx-auto transition-all duration-300 rounded-xl border border-[var(--border)] bg-white overflow-hidden shadow-sm min-h-[60vh]"
        style={{ maxWidth }}
      >
        {children}
      </div>
    </div>
  );
}
