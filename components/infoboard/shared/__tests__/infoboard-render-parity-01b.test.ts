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
import {
  KIOSK_SHELL_FOOTER_HEIGHT_PX,
  KIOSK_SHELL_FOOTER_TICKER_FONT_PX,
  KIOSK_SHELL_HEADER_HEIGHT_PX,
  KIOSK_SHELL_SUBTITLE_HEIGHT_PX,
  KIOSK_SHELL_WEATHER_CONDITION_FONT_PX,
  KIOSK_SHELL_WEATHER_ICON_PX,
  KIOSK_SHELL_WEATHER_TEMP_FONT_PX,
} from "@/lib/infoboard/kiosk-shell-sizing";

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

describe("INFOBOARD-FOOTER-READABILITY-01 — shared footer contract", () => {
  it("defines the canonical footer height and ticker font in one module", () => {
    const sizing = readRepoFile("lib/infoboard/kiosk-shell-sizing.ts");
    expect(sizing).toContain(`KIOSK_SHELL_FOOTER_HEIGHT_PX = ${KIOSK_SHELL_FOOTER_HEIGHT_PX}`);
    expect(sizing).toContain(
      `KIOSK_SHELL_FOOTER_TICKER_FONT_PX = ${KIOSK_SHELL_FOOTER_TICKER_FONT_PX}`,
    );
    expect(KIOSK_SHELL_MEASUREMENT_CONTRACT.footerHeightPx).toBe(KIOSK_SHELL_FOOTER_HEIGHT_PX);
    expect(KIOSK_SHELL_MEASUREMENT_CONTRACT.footerTickerFontPx).toBe(
      KIOSK_SHELL_FOOTER_TICKER_FONT_PX,
    );
  });

  it("keeps header, subtitle, and weather tokens unchanged", () => {
    expect(KIOSK_SHELL_MEASUREMENT_CONTRACT.headerHeightPx).toBe(KIOSK_SHELL_HEADER_HEIGHT_PX);
    expect(KIOSK_SHELL_MEASUREMENT_CONTRACT.subtitleHeightPx).toBe(KIOSK_SHELL_SUBTITLE_HEIGHT_PX);
    const sizing = readRepoFile("lib/infoboard/kiosk-shell-sizing.ts");
    expect(sizing).toContain(`KIOSK_SHELL_WEATHER_ICON_PX = ${KIOSK_SHELL_WEATHER_ICON_PX}`);
    expect(sizing).toContain(
      `KIOSK_SHELL_WEATHER_TEMP_FONT_PX = ${KIOSK_SHELL_WEATHER_TEMP_FONT_PX}`,
    );
    expect(sizing).toContain(
      `KIOSK_SHELL_WEATHER_CONDITION_FONT_PX = ${KIOSK_SHELL_WEATHER_CONDITION_FONT_PX}`,
    );
  });

  it("routes Screen 1, Screen 2, and preview through KioskShellFooter only", () => {
    const screen1 = readRepoFile("components/infoboard/screen1/InfoboardScreen1.tsx");
    const screen2 = readRepoFile("components/infoboard/screen2/InfoboardScreen2.tsx");
    const anlageplan = readRepoFile("components/infoboard/anlageplan/InfoboardAnlageplan.tsx");
    const previewFrame = readRepoFile("components/infoboard/preview/PreviewFrame.tsx");

    expect(screen1).toContain("KioskShellFooter");
    expect(screen2).toContain("KioskShellFooter");
    expect(anlageplan).toContain("KioskShellFooter");
    expect(previewFrame).toContain("InfoboardScreen1");
    expect(previewFrame).toContain("InfoboardScreen2");
    expect(previewFrame).toContain("InfoboardAnlageplan");
  });

  it("does not define Screen 1 or Screen 2 scoped footer sizing overrides", () => {
    const screen1Css = readRepoFile("components/infoboard/screen1/InfoboardScreen1.module.css");
    const screen2Css = readRepoFile("components/infoboard/screen2/InfoboardScreen2.module.css");
    const screen1Tsx = readRepoFile("components/infoboard/screen1/InfoboardScreen1.tsx");
    const screen2Tsx = readRepoFile("components/infoboard/screen2/InfoboardScreen2.tsx");

    expect(screen1Tsx).not.toMatch(/footerHeightPx\s*[:=]/);
    expect(screen2Tsx).not.toMatch(/footerHeightPx\s*[:=]/);
    expect(screen1Tsx).not.toMatch(/FOOTER_TICKER_FONT/);
    expect(screen2Tsx).not.toMatch(/FOOTER_TICKER_FONT/);
    expect(screen2Css).not.toContain("kiosk-shell-footer");
    expect(screen1Css).toContain("var(--kiosk-shell-footer-ticker-font");
    expect(screen1Css).not.toMatch(/font-size:\s*16px/);
  });

  it("AnnouncementTicker consumes the shared footer ticker font token", () => {
    const tickerCss = readRepoFile("components/infoboard/screen1/InfoboardScreen1.module.css");
    expect(tickerCss).toContain("var(--kiosk-shell-footer-ticker-font");
    const footer = readRepoFile("components/infoboard/shared/KioskShellFooter.tsx");
    expect(footer).toContain("kiosk-shell-sizing");
    expect(footer).toContain("--kiosk-shell-footer-ticker-font");
  });
});
