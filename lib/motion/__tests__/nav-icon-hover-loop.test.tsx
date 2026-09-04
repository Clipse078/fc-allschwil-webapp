/**
 * @vitest-environment jsdom
 *
 * SCE-DESIGN-04D — Continuous hover loop engineering tests
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { NAV_ICON_KEYS } from "@/lib/motion/nav-icon-keys";
import {
  COPPER_FLOW_ICON_KEYS,
  getAllSidebarNavIconKeys,
  getAllSidebarNavLabels,
  getNavIconKey,
} from "@/lib/motion/nav-icon-registry";
import { NAV_ICON_COMPONENTS } from "@/components/ui/motion/nav-icons";
import { SCE_MOTION_LOOP } from "@/lib/motion/motion-tokens";
import { render } from "@testing-library/react";
import { AnimatedNavIcon } from "@/components/ui/motion/AnimatedNavIcon";

const CSS_PATH = join(process.cwd(), "app/nav-icon-animations.css");
const MOTION_DIR = join(process.cwd(), "components/ui/motion");

function readMotionSources(): string {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(tsx?|css)$/.test(entry.name)) files.push(readFileSync(full, "utf8"));
    }
  };
  walk(MOTION_DIR);
  return files.join("\n");
}

describe("nav-icon hover loops (SCE-DESIGN-04D)", () => {
  const css = readFileSync(CSS_PATH, "utf8");

  it("covers all 54 sidebar nav labels with icon keys", () => {
    const labels = getAllSidebarNavLabels();
    expect(labels).toHaveLength(54);
    expect(new Set(getAllSidebarNavIconKeys()).size).toBe(54);
  });

  it("has a bespoke icon component with animated elements for every icon key", () => {
    for (const key of NAV_ICON_KEYS) {
      expect(NAV_ICON_COMPONENTS[key]).toBeDefined();
      const { container } = render(<AnimatedNavIcon label={resolveLabel(key)} />);
      const animated = container.querySelector("[class*='ani-']");
      expect(animated, `missing ani- element for ${key}`).toBeTruthy();
    }
  });

  it("defines infinite hover loop on pointer hover only", () => {
    expect(css).toContain("animation-iteration-count: infinite");
    expect(css).toMatch(
      /\.sce-nav-item:hover \.sce-animated-nav-icon \[class\*="ani-"\][\s\S]*animation-iteration-count: infinite/,
    );
    expect(css).toMatch(
      /\.sce-nav-child:hover \.sce-animated-nav-icon \[class\*="ani-"\][\s\S]*animation-iteration-count: infinite/,
    );
  });

  it("uses loop keyframes with rest beats (stable end state)", () => {
    expect(css).toContain("@keyframes sce-nav-loop-settle-y");
    expect(css).toContain("@keyframes sce-nav-loop-copper-travel");
    expect(css).toContain("32%, 100%");
    expect(css).toContain("38%, 100%");
  });

  it("defines loop cadence CSS variables in shared tokens", () => {
    expect(css).toContain("--sce-nav-loop-duration");
    expect(css).toContain("--sce-nav-hover-intent-delay");
    expect(SCE_MOTION_LOOP.durationBase).toBeGreaterThanOrEqual(1400);
    expect(SCE_MOTION_LOOP.durationLong).toBeLessThanOrEqual(3000);
  });

  it("disables continuous loops under prefers-reduced-motion", () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none !important/,
    );
  });

  it("does not loop animations on focus-visible (keyboard)", () => {
    expect(css).toMatch(
      /\.sce-nav-item:focus-visible \.sce-animated-nav-icon \[class\*="ani-"\][\s\S]*animation: none !important/,
    );
  });

  it("does not introduce JS timer-based animation", () => {
    const sources = readMotionSources();
    expect(sources).not.toMatch(/\bsetInterval\s*\(/);
    expect(sources).not.toMatch(/\brequestAnimationFrame\s*\(/);
  });

  it("does not use legacy one-shot-only keyframe names for hover", () => {
    expect(css).not.toContain("animation-name: sce-nav-settle-y");
    expect(css).not.toContain("animation-name: sce-nav-copper-travel");
    expect(css).not.toContain("animation-name: sce-nav-pulse-once");
  });

  it("keeps copper-flow icons semantically scoped", () => {
    expect(COPPER_FLOW_ICON_KEYS.size).toBeGreaterThan(0);
    for (const key of COPPER_FLOW_ICON_KEYS) {
      expect(NAV_ICON_KEYS).toContain(key);
    }
  });

  it("does not introduce forbidden brand orange", () => {
    expect(css.toLowerCase()).not.toContain("#ff6a00");
    expect(css).toContain("#d4843a");
    expect(css).toContain("#be7232");
  });
});

/** Resolve any sidebar label for a given icon key (first match). */
function resolveLabel(key: string): string {
  for (const label of getAllSidebarNavLabels()) {
    if (getNavIconKey(label) === key) return label;
  }
  throw new Error(`No label for icon key: ${key}`);
}
