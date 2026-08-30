/**
 * TEAM-DATA-INTEGRITY-01 — bootstrap / deploy must not implicitly recreate demo data.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateDemoSeedGuard } from "@/lib/demo/seed-guard";

describe("demo data bootstrap safety", () => {
  it("prisma db seed hook points at reference seed only, not seed-demo", () => {
    const config = readFileSync(resolve(process.cwd(), "prisma.config.ts"), "utf8");
    expect(config).toContain('seed: "tsx prisma/seed.ts"');
    expect(config).not.toContain("seed-demo");
  });

  it("production build script does not invoke db:seed-demo", () => {
    const pkg = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts.build).not.toContain("seed-demo");
    expect(pkg.scripts.postinstall).not.toContain("seed-demo");
    expect(pkg.scripts.start).not.toContain("seed-demo");
  });

  it("STAGE deploy cannot run demo seed without ALLOW_DEMO_SEED=true", () => {
    expect(evaluateDemoSeedGuard({ APP_ENV: "stage" }).allowed).toBe(false);
    expect(
      evaluateDemoSeedGuard({ APP_ENV: "stage", ALLOW_DEMO_SEED: "true" }).allowed,
    ).toBe(true);
  });
});
