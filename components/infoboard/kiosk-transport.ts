"use client";
/**
 * components/infoboard/kiosk-transport.ts
 *
 * Client-side canonical transport refresh for long-running Infoboard kiosks.
 */

import { useEffect, useState } from "react";
import type { TransportResult } from "@/lib/transport/transport-types";

function isTransportResult(value: unknown): value is TransportResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  return typeof (value as TransportResult).isAvailable === "boolean";
}

/**
 * Keeps kiosk transport aligned with the canonical server cache.
 */
export function useKioskTransport(
  initialTransport: TransportResult | null | undefined,
  refreshIntervalSeconds: number,
  tenantKey?: string | null,
  live = true,
): TransportResult | null | undefined {
  const [polledTransport, setPolledTransport] = useState(initialTransport);

  const [prevInitialTransport, setPrevInitialTransport] = useState(initialTransport);
  if (initialTransport !== prevInitialTransport) {
    setPrevInitialTransport(initialTransport);
    setPolledTransport(initialTransport);
  }

  useEffect(() => {
    if (!live || !tenantKey) {
      return undefined;
    }

    const resolvedTenantKey = tenantKey;
    let cancelled = false;

    async function refreshTransport(): Promise<void> {
      try {
        const response = await fetch("/api/public/infoboard/transport", {
          cache: "no-store",
          headers: {
            "X-Tenant-Slug": resolvedTenantKey,
          },
        });

        if (!response.ok) {
          return;
        }

        const payload: unknown = await response.json();
        if (!cancelled && isTransportResult(payload)) {
          setPolledTransport(payload);
        }
      } catch {
        // Preserve the last known departures on transient network errors.
      }
    }

    const syncId = window.setTimeout(() => {
      void refreshTransport();
    }, 1_000);

    const intervalId = window.setInterval(() => {
      void refreshTransport();
    }, refreshIntervalSeconds * 1_000);

    return () => {
      cancelled = true;
      window.clearTimeout(syncId);
      window.clearInterval(intervalId);
    };
  }, [live, refreshIntervalSeconds, tenantKey]);

  return live ? polledTransport : initialTransport;
}
