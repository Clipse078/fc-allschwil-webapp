/**
 * app/api/public/infoboard/weather/route.ts
 *
 * GET /api/public/infoboard/weather
 *
 * Public JSON endpoint for canonical Infoboard kiosk weather refresh.
 * Used by long-running TV / Fully Kiosk sessions to update header weather
 * without a full page reload.
 *
 * Response: WeatherResult serialised as JSON.
 * Caching: Cache-Control aligned with canonical kiosk weather revalidation.
 */

import { NextResponse } from "next/server";
import {
  CANONICAL_KIOSK_WEATHER_REVALIDATE_SECONDS,
  getCanonicalKioskWeather,
} from "@/lib/infoboard/kiosk-weather";

export async function GET(): Promise<NextResponse> {
  try {
    const weather = await getCanonicalKioskWeather();

    return NextResponse.json(weather, {
      status: 200,
      headers: {
        "Cache-Control": `public, max-age=${CANONICAL_KIOSK_WEATHER_REVALIDATE_SECONDS}`,
      },
    });
  } catch (error) {
    console.error("[infoboard weather API] Internal error:", error);

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
