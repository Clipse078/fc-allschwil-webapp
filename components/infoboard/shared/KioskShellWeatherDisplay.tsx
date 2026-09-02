/**
 * components/infoboard/shared/KioskShellWeatherDisplay.tsx
 *
 * Canonical kiosk header weather presentation shared by all Infoboard screens.
 */

import type { ReactElement } from "react";
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
} from "lucide-react";
import { resolveWeatherVisual } from "@/components/infoboard/shared/weatherVisual";
import {
  KIOSK_SHELL_CSS_VARS,
} from "@/lib/infoboard/kiosk-shell-sizing";
import type { WeatherResult } from "@/lib/weather/weather-types";

export function KioskShellWeatherDisplay({
  weather,
}: {
  weather: WeatherResult;
}): ReactElement | null {
  if (weather.isAvailable !== true) {
    return null;
  }

  const weatherVisual = resolveWeatherVisual(weather.conditionCode);

  const Icon =
    weatherVisual.iconFamily === "sun"
      ? Sun
      : weatherVisual.iconFamily === "cloud-sun"
        ? CloudSun
        : weatherVisual.iconFamily === "cloud-rain"
          ? CloudRain
          : weatherVisual.iconFamily === "snow"
            ? CloudSnow
            : weatherVisual.iconFamily === "fog"
              ? CloudFog
              : weatherVisual.iconFamily === "storm"
                ? CloudLightning
                : Cloud;

  const iconColor = weatherVisual.color;
  const temperature = Math.round(weather.temperatureC);

  return (
    <div
      data-testid="header-weather"
      aria-label="Wetter"
      style={{
        display: "grid",
        gridTemplateColumns: "auto auto minmax(0, 1fr)",
        alignItems: "center",
        columnGap: "14px",
        minWidth: "max-content",
        width: "auto",
        whiteSpace: "nowrap",
      }}
    >
      <Icon
        aria-hidden="true"
        size={Number.parseInt(KIOSK_SHELL_CSS_VARS["--kiosk-shell-weather-icon"], 10)}
        strokeWidth={1.6}
        style={{
          color: iconColor,
          flexShrink: 0,
        }}
      />

      <span
        data-testid="header-weather-temperature"
        style={{
          fontSize: KIOSK_SHELL_CSS_VARS["--kiosk-shell-weather-temp-font"],
          fontWeight: 800,
          color: "#ffffff",
          lineHeight: 1,
          letterSpacing: "0.01em",
        }}
      >
        {temperature}°
      </span>

      <span
        data-testid="header-weather-condition"
        style={{
          fontSize: KIOSK_SHELL_CSS_VARS["--kiosk-shell-weather-condition-font"],
          fontWeight: 500,
          color: "rgba(255,255,255,0.74)",
          lineHeight: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
        }}
      >
        {weather.conditionLabel}
      </span>
    </div>
  );
}
