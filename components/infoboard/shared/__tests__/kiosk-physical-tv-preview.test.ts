/**
 * @vitest-environment node
 *
 * INFOBOARD-TV-SHELL-01B — physical-TV preview architecture for both screens.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();

function readRepoFile(path: string): string {
  return readFileSync(join(REPO_ROOT, path), "utf8");
}

describe("physical-TV preview architecture", () => {
  it("Screen 1 kiosk route uses PhysicalInfoboardViewport via shared layout", () => {
    const layout = readRepoFile("app/infoboard/screen-1/layout.tsx");
    expect(layout).toContain("Screen1KioskViewportLayout");
    expect(readRepoFile("components/infoboard/shared/KioskViewportLayout.tsx")).toContain(
      "PhysicalInfoboardViewport",
    );
  });

  it("Screen 2 kiosk route uses the same KioskViewportScaler layout", () => {
    const layout = readRepoFile("app/infoboard/screen-2/layout.tsx");
    expect(layout).toContain("Screen2KioskViewportLayout");
    expect(readRepoFile("components/infoboard/screen2/Screen2KioskViewportLayout.tsx")).toContain(
      "KioskViewportLayout",
    );
  });

  it("dashboard PreviewFrame uses real renderers inside PhysicalInfoboardViewport for both screens", () => {
    const previewFrame = readRepoFile("components/infoboard/preview/PreviewFrame.tsx");
    expect(previewFrame).toMatch(/PreviewFrameScreen1[\s\S]*PhysicalInfoboardViewport[\s\S]*InfoboardScreen1/);
    expect(previewFrame).toMatch(/PreviewFrameScreen2[\s\S]*PhysicalInfoboardViewport[\s\S]*InfoboardScreen2/);
    expect(previewFrame).toMatch(/PreviewFrameAnlageplan[\s\S]*PhysicalInfoboardViewport[\s\S]*InfoboardAnlageplan/);
  });

  it("Screen2PhysicalTvPreview remains unused — no duplicate preview renderer", () => {
    const grepTargets = [
      "app/infoboard/preview-frame/page.tsx",
      "components/infoboard/preview/PreviewFrame.tsx",
      "app/infoboard/preview/screen-2/page.tsx",
    ];
    for (const file of grepTargets) {
      expect(readRepoFile(file)).not.toContain("Screen2PhysicalTvPreview");
    }
  });

  it("canonical shell sizing is defined in one shared module", () => {
    const sizing = readRepoFile("lib/infoboard/kiosk-shell-sizing.ts");
    expect(sizing).toContain("KIOSK_SHELL_CANVAS_WIDTH = KIOSK_LOGICAL_WIDTH");
    expect(sizing).toContain("KIOSK_SHELL_HEADER_HEIGHT_PX = 81");
    expect(readRepoFile("components/infoboard/shared/KioskShellHeader.tsx")).toContain(
      "kiosk-shell-sizing",
    );
    expect(readRepoFile("components/infoboard/shared/KioskShellFooter.tsx")).toContain(
      "kiosk-shell-sizing",
    );
  });
});
