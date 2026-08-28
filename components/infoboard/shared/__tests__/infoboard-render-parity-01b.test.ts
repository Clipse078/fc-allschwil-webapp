/**
 * @vitest-environment node
 *
 * INFOBOARD-RENDER-PARITY-01B — canonical physical-TV renderer contract.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  KIOSK_LOGICAL_HEIGHT,
  KIOSK_LOGICAL_WIDTH,
} from "@/lib/infoboard/kiosk-viewport";
import { KIOSK_SHELL_MEASUREMENT_CONTRACT } from "@/lib/infoboard/kiosk-shell-sizing";

const REPO_ROOT = process.cwd();

function readRepoFile(path: string): string {
  return readFileSync(join(REPO_ROOT, path), "utf8");
}

describe("INFOBOARD-RENDER-PARITY-01B — canonical physical-TV surface", () => {
  it("exports PhysicalInfoboardViewport as the shared 1920×1080 wrapper", () => {
    const viewport = readRepoFile(
      "components/infoboard/shared/PhysicalInfoboardViewport.tsx",
    );
    expect(viewport).toContain("PhysicalInfoboardViewport");
    expect(viewport).toContain("KioskViewportScaler");
    expect(viewport).toContain("Scaling happens exactly once here");
  });

  it("routes Screen 1 and Screen 2 kiosk layouts through PhysicalInfoboardViewport", () => {
    const layout = readRepoFile("components/infoboard/shared/KioskViewportLayout.tsx");
    expect(layout).toContain("PhysicalInfoboardViewport");
  });

  it("Dashboard Preview Screen 1 uses PhysicalInfoboardViewport + InfoboardScreen1", () => {
    const previewFrame = readRepoFile("components/infoboard/preview/PreviewFrame.tsx");
    expect(previewFrame).toMatch(
      /PreviewFrameScreen1[\s\S]*PhysicalInfoboardViewport[\s\S]*InfoboardScreen1/,
    );
  });

  it("Dashboard Preview Screen 2 Anlageplan uses the same viewport wrapper as kiosk", () => {
    const previewFrame = readRepoFile("components/infoboard/preview/PreviewFrame.tsx");
    const previewPage = readRepoFile("app/infoboard/preview-frame/page.tsx");
    expect(previewFrame).toMatch(
      /PreviewFrameAnlageplan[\s\S]*PhysicalInfoboardViewport[\s\S]*InfoboardAnlageplan/,
    );
    expect(previewPage).toContain("PreviewFrameAnlageplan");
    expect(previewPage).not.toContain("PreviewFrameStatic");
  });

  it("Dashboard Preview Screen 2 legacy board uses PhysicalInfoboardViewport", () => {
    const previewFrame = readRepoFile("components/infoboard/preview/PreviewFrame.tsx");
    expect(previewFrame).toMatch(
      /PreviewFrameScreen2[\s\S]*PhysicalInfoboardViewport[\s\S]*InfoboardScreen2/,
    );
  });

  it("does not nest PhysicalInfoboardViewport inside route layouts", () => {
    const screen1Page = readRepoFile("app/infoboard/screen-1/page.tsx");
    const screen2Page = readRepoFile("app/infoboard/screen-2/page.tsx");
    expect(screen1Page).not.toContain("PhysicalInfoboardViewport");
    expect(screen1Page).not.toContain("KioskViewportScaler");
    expect(screen2Page).not.toContain("PhysicalInfoboardViewport");
    expect(screen2Page).not.toContain("KioskViewportScaler");
  });

  it("canvas CSS declares the physical-infoboard size container", () => {
    const css = readRepoFile("components/infoboard/shared/KioskViewportScaler.module.css");
    expect(css).toContain("container-type: size");
    expect(css).toContain("container-name: physical-infoboard");
  });

  it("keeps the canonical logical canvas at 1920×1080", () => {
    expect(KIOSK_LOGICAL_WIDTH).toBe(1920);
    expect(KIOSK_LOGICAL_HEIGHT).toBe(1080);
    expect(KIOSK_SHELL_MEASUREMENT_CONTRACT.canvasWidth).toBe(1920);
    expect(KIOSK_SHELL_MEASUREMENT_CONTRACT.canvasHeight).toBe(1080);
  });

  it("Anlageplan root fills the canvas instead of using 100dvh", () => {
    const anlageplan = readRepoFile("components/infoboard/anlageplan/InfoboardAnlageplan.tsx");
    expect(anlageplan).toContain('height: "100%"');
    expect(anlageplan).not.toContain("100dvh");
    expect(anlageplan).toContain("anlageplan-main-region");
  });

  it("Screen 1 preview and kiosk share buildScreen1KioskPresentation", () => {
    const previewData = readRepoFile("lib/infoboard/preview-data.ts");
    const kioskPage = readRepoFile("app/infoboard/screen-1/page.tsx");
    expect(previewData).toContain("buildScreen1KioskPresentation");
    expect(kioskPage).toContain("buildScreen1KioskPresentation");
  });
});
