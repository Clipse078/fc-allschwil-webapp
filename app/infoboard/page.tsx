import InfoboardDisplay from "@/components/infoboard/InfoboardDisplay";

/**
 * /infoboard — Public kiosk display.
 *
 * No authentication required. The InfoboardDisplay client component
 * polls /api/public/infoboard every 60 seconds and renders events
 * grouped by date in a fullscreen layout.
 */
export default function InfoboardPage() {
  return <InfoboardDisplay />;
}
