import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pool: vi.fn(),
  adapter: vi.fn(),
  prismaClient: vi.fn(),
}));

vi.mock("pg", () => ({ Pool: mocks.pool }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: mocks.adapter }));
vi.mock("@prisma/client", () => ({ PrismaClient: mocks.prismaClient }));

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
  vi.clearAllMocks();
});

describe("application Prisma test boundary", () => {
  it("is import-safe without DATABASE_URL but fails closed on runtime use", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_URL;
    delete process.env.DIRECT_URL;
    delete process.env.TEST_DATABASE_URL;

    const { prisma } = await import("@/lib/db/prisma");

    expect(mocks.pool).not.toHaveBeenCalled();
    expect(() => prisma.user).toThrow(/DATABASE_URL is not configured/);
    expect(mocks.pool).not.toHaveBeenCalled();
    expect(mocks.adapter).not.toHaveBeenCalled();
    expect(mocks.prismaClient).not.toHaveBeenCalled();
  });

  it("rejects ambient runtime DATABASE_URL on first use before constructing a Pool", async () => {
    delete process.env.TEST_DATABASE_URL;
    process.env.DATABASE_URL =
      "postgresql://stage:secret@stage-db.example.com:5432/application";

    const { prisma } = await import("@/lib/db/prisma");

    expect(() => prisma.$connect).toThrow(
      /explicit local TEST_DATABASE_URL required/,
    );
    expect(mocks.pool).not.toHaveBeenCalled();
    expect(mocks.adapter).not.toHaveBeenCalled();
    expect(mocks.prismaClient).not.toHaveBeenCalled();
  });
});
