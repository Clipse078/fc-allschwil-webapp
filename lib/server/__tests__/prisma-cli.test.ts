import { describe, expect, it } from "vitest";
import { resolvePrismaCliPath } from "@/lib/server/prisma-cli";

describe("resolvePrismaCliPath", () => {
  it("resolves the locally installed Prisma CLI JavaScript entry point", () => {
    const cliPath = resolvePrismaCliPath();

    expect(cliPath).toMatch(/prisma[/\\]build[/\\]index\.js$/);
    expect(cliPath.endsWith(".cmd")).toBe(false);
  });
});
