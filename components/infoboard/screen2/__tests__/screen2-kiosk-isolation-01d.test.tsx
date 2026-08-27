/**
 * @vitest-environment jsdom
 *
 * INFOBOARD-KIOSK-VIEWPORT-01D — Screen 2 must not inherit Screen-1 kiosk scaler.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InfoboardScreen2 } from "@/components/infoboard/screen2/InfoboardScreen2";
import { PREVIEW_FIXTURE_SCREEN2 } from "@/components/infoboard/screen2/screen2-preview-fixture";

const REPO_ROOT = process.cwd();

function readRepoFile(path: string): string {
  return readFileSync(join(REPO_ROOT, path), "utf8");
}

describe("INFOBOARD-KIOSK-VIEWPORT-01D — Screen 2 kiosk isolation", () => {
  it("global infoboard layout does not wrap all routes in KioskViewportScaler", () => {
    const layout = readRepoFile("app/infoboard/layout.tsx");
    expect(layout).not.toContain("KioskViewportScaler");
    expect(layout).toContain("min-h-screen");
  });

  it("screen-1 route layout applies KioskViewportScaler", () => {
    const layout = readRepoFile("app/infoboard/screen-1/layout.tsx");
    expect(layout).toContain("Screen1KioskViewportLayout");
  });

  it("screen-2 route has no dedicated kiosk viewport layout", () => {
    expect(() => readRepoFile("app/infoboard/screen-2/layout.tsx")).toThrow();
  });

  it("Screen2 CSS has no kiosk viewport canvas overrides vs accepted STAGE", () => {
    const css = readRepoFile("components/infoboard/screen2/InfoboardScreen2.module.css");
    expect(css).not.toContain("data-kiosk-viewport-canvas");
    expect(css).not.toContain("kioskViewport");
  });

  it("kiosk scaler CSS does not mutate global html/body overflow", () => {
    const css = readRepoFile("components/infoboard/shared/KioskViewportScaler.module.css");
    expect(css).not.toMatch(/:global\(html\)/);
    expect(css).not.toMatch(/:global\(body\)/);
    expect(css).not.toContain("infoboard-anlageplan-root");
  });

  it("PreviewFrameScreen1 applies scaler but PreviewFrameStatic does not", () => {
    const previewFrame = readRepoFile("components/infoboard/preview/PreviewFrame.tsx");
    expect(previewFrame).toContain("KioskViewportScaler");
    expect(previewFrame).toMatch(/PreviewFrameScreen1[\s\S]*KioskViewportScaler/);
    expect(previewFrame).not.toMatch(/PreviewFrameStatic[\s\S]*KioskViewportScaler/);
  });

  it("InfoboardScreen2 renders without kiosk viewport scaler wrapper", () => {
    const { container } = render(
      <InfoboardScreen2 feed={PREVIEW_FIXTURE_SCREEN2} />,
    );
    expect(screen.getByTestId("infoboard-screen2-root")).toBeTruthy();
    expect(container.querySelector('[data-testid="kiosk-viewport-scaler"]')).toBeNull();
    expect(container.querySelector('[data-kiosk-viewport-canvas="true"]')).toBeNull();
  });
});
