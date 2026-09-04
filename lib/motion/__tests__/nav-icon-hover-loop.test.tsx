/**
 * @vitest-environment jsdom
 *
 * SCE-DESIGN-04D/04E — Continuous hover loop engineering tests
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
import { SCE_MOTION_EASING, SCE_MOTION_LOOP } from "@/lib/motion/motion-tokens";
import { render } from "@testing-library/react";
import { AnimatedNavIcon } from "@/components/ui/motion/AnimatedNavIcon";

const CSS_PATH = join(process.cwd(), "app/nav-icon-animations.css");
const GLOBALS_CSS_PATH = join(process.cwd(), "app/globals.css");
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

describe("nav-icon hover loops (SCE-DESIGN-04E)", () => {
  const css = readFileSync(CSS_PATH, "utf8");
  const globalsCss = readFileSync(GLOBALS_CSS_PATH, "utf8");

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

  it("uses loop keyframes with short rest beats (motion-dominant cycle)", () => {
    expect(css).toContain("@keyframes sce-nav-loop-settle-y");
    expect(css).toContain("@keyframes sce-nav-loop-copper-travel");
    expect(css).toContain("82%, 100%");
    expect(css).toContain("80%, 100%");
    expect(css).not.toContain("38%, 100%");
    expect(css).not.toContain("32%, 100%");
  });

  it("defines faster loop cadence CSS variables in shared tokens", () => {
    expect(css).toContain("--sce-nav-loop-duration");
    expect(css).toContain("--sce-nav-hover-intent-delay");
    expect(globalsCss).toContain("--sce-nav-loop-duration-copper");
    expect(globalsCss).toContain("--sce-motion-ease-loop");
    expect(globalsCss).toContain("--sce-nav-leave-settle");
  });

  it("enforces near-immediate hover intent delay (<= 20ms)", () => {
    expect(SCE_MOTION_LOOP.hoverDelay).toBeLessThanOrEqual(20);
    expect(SCE_MOTION_LOOP.durationBase).toBeGreaterThanOrEqual(900);
    expect(SCE_MOTION_LOOP.durationBase).toBeLessThanOrEqual(1400);
    expect(SCE_MOTION_LOOP.durationChild).toBeGreaterThanOrEqual(1000);
    expect(SCE_MOTION_LOOP.durationChild).toBeLessThanOrEqual(1500);
    expect(SCE_MOTION_LOOP.durationCopper).toBeGreaterThanOrEqual(800);
    expect(SCE_MOTION_LOOP.durationCopper).toBeLessThanOrEqual(1200);
  });

  it("uses dedicated copper-flow cadence faster than parent base loop", () => {
    expect(SCE_MOTION_LOOP.durationCopper).toBeLessThan(SCE_MOTION_LOOP.durationBase);
    expect(css).toContain("var(--sce-nav-loop-duration-copper)");
  });

  it("centralizes premium easing tokens without bounce/elastic", () => {
    expect(SCE_MOTION_EASING.out).toContain("cubic-bezier");
    expect(SCE_MOTION_EASING.premium).toContain("cubic-bezier");
    expect(SCE_MOTION_EASING.loop).toContain("cubic-bezier");
    expect(SCE_MOTION_EASING.out).not.toContain("elastic");
    expect(SCE_MOTION_EASING.loop).not.toContain("bounce");
    expect(css).toContain("var(--sce-motion-ease-loop)");
  });

  it("defines pointer-leave settle transition", () => {
    expect(css).toContain("var(--sce-nav-leave-settle)");
    expect(SCE_MOTION_LOOP.leaveSettle).toBeGreaterThanOrEqual(100);
    expect(SCE_MOTION_LOOP.leaveSettle).toBeLessThanOrEqual(150);
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
