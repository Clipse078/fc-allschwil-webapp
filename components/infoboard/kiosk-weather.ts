"use client";
/**
 * components/infoboard/kiosk-weather.ts
 *
 * Client-side canonical weather refresh for long-running Infoboard kiosks.
 * Polls the public weather API on the same cadence as server cache TTL.
 */

import { useEffect, useState } from "react";
import type { WeatherResult } from "@/lib/weather/weather-types";
import { CANONICAL_KIOSK_WEATHER_REVALIDATE_SECONDS } from "@/lib/infoboard/kiosk-weather";

const WEATHER_API_PATH = "/api/public/infoboard/weather";

function isWeatherResult(value: unknown): value is WeatherResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  return typeof (value as WeatherResult).isAvailable === "boolean";
}

/**
 * Keeps kiosk header weather aligned with the canonical server cache.
 *
 * - Starts from SSR `initialWeather` for hydration-safe first paint.
 * - Refreshes on mount (after hydration) and every revalidation interval.
 */
export function useKioskWeather(
  initialWeather: WeatherResult | null | undefined,
  live = true,
): WeatherResult | null | undefined {
  const [polledWeather, setPolledWeather] = useState(initialWeather);

  const [prevInitialWeather, setPrevInitialWeather] = useState(initialWeather);
  if (initialWeather !== prevInitialWeather) {
    setPrevInitialWeather(initialWeather);
    setPolledWeather(initialWeather);
  }

  useEffect(() => {
    if (!live) {
      return undefined;
    }

    let cancelled = false;

    async function refreshWeather(): Promise<void> {
      try {
        const response = await fetch(WEATHER_API_PATH, {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload: unknown = await response.json();

        if (!cancelled && isWeatherResult(payload)) {
          setPolledWeather(payload);
        }
      } catch {
        // Preserve the last known weather on transient network errors.
      }
    }

    const syncId = window.setTimeout(() => {
      void refreshWeather();
    }, 1_000);

    const intervalId = window.setInterval(() => {
      void refreshWeather();
    }, CANONICAL_KIOSK_WEATHER_REVALIDATE_SECONDS * 1_000);

    return () => {
      cancelled = true;
      window.clearTimeout(syncId);
      window.clearInterval(intervalId);
    };
  }, [live]);

  return live ? polledWeather : initialWeather;
}
