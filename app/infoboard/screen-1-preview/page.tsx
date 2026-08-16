import { notFound } from "next/navigation";

import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import {
  PREVIEW_EVENT_TYPE_REGRESSION_EXTENSIONS,
  PREVIEW_FIXTURE_EVENT_TYPE_REGRESSION,
} from "@/components/infoboard/screen1/screen1-preview-fixture";

export default function InfoboardScreen1PreviewPage() {
  const previewAllowed =
    process.env.NODE_ENV === "development" ||
    process.env.VERCEL_GIT_COMMIT_REF === "STAGE";

  if (!previewAllowed) {
    notFound();
  }

  return (
    <InfoboardScreen1
      weather={{
        isAvailable: true,
        temperatureC: 24,
        conditionCode: 2,
        conditionLabel: "Heiter",
        windKmh: 6,
        precipitationProbability: null,
        observedAt: "2026-08-16T15:30:00.000Z",
      }}
      feed={PREVIEW_FIXTURE_EVENT_TYPE_REGRESSION}
      eventPresentation={PREVIEW_EVENT_TYPE_REGRESSION_EXTENSIONS}
      currentTimeIso="2026-09-12T06:30:00.000Z"
    />
  );
}