"use client";
/**
 * components/infoboard/shared/LiveKioskShellWeather.tsx
 *
 * Client wrapper that keeps header weather fresh on long-running kiosk sessions.
 */

import type { ReactElement } from "react";
import { useKioskWeather } from "@/components/infoboard/kiosk-weather";
import { KioskShellWeatherDisplay } from "@/components/infoboard/shared/KioskShellWeatherDisplay";
import type { WeatherResult } from "@/lib/weather/weather-types";

export type LiveKioskShellWeatherProps = {
  initialWeather: WeatherResult;
  /** Preview-only escape hatch. Production defaults to live refresh. */
  live?: boolean;
};

export function LiveKioskShellWeather({
  initialWeather,
  live = true,
}: LiveKioskShellWeatherProps): ReactElement | null {
  const weather = useKioskWeather(initialWeather, live);

  if (weather == null || weather.isAvailable !== true) {
    return null;
  }

  return <KioskShellWeatherDisplay weather={weather} />;
}
