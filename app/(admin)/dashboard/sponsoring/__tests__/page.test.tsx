// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requirePermission = vi.hoisted(() => vi.fn());

vi.mock("@/lib/permissions/require-any-permission", () => ({
  requireAnyPermission: requirePermission,
}));

import SponsoringPage from "../page";

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue(undefined);
});

describe("Sponsoring future module landing page", () => {
  it("shows the planned commercial lifecycle without functional controls", async () => {
    render(await SponsoringPage());

    expect(screen.getByRole("heading", { level: 1, name: "Sponsoring" })).toBeInTheDocument();
    expect(screen.getByText(/Demo-Ansicht · Noch nicht funktional/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sponsoren" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Verträge & Dokumente" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kampagnen" })).toBeInTheDocument();
    expect(screen.getByText("SponsorAsset")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
  });

  it("checks authorization before rendering the future shell", async () => {
    requirePermission.mockRejectedValue(new Error("Forbidden"));
    await expect(SponsoringPage()).rejects.toThrow("Forbidden");
  });
});
