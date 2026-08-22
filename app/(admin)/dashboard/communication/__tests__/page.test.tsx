// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requirePermission = vi.hoisted(() => vi.fn());

vi.mock("@/lib/permissions/require-any-permission", () => ({
  requireAnyPermission: requirePermission,
}));

import CommunicationPage from "../page";

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue(undefined);
});

describe("Kommunikation module landing page", () => {
  it("distinguishes the functional sender settings from future capabilities", async () => {
    render(await CommunicationPage());

    expect(screen.getByRole("heading", { level: 1, name: "Kommunikation" })).toBeInTheDocument();
    expect(screen.getByText("E-Mail-Absender ist bereits verfügbar.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Absender verwalten/ })).toHaveAttribute(
      "href",
      "/dashboard/communication/email-sender",
    );
    expect(screen.getByRole("heading", { name: "Zielgruppen" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vorlagen" })).toBeInTheDocument();
    expect(screen.getAllByText("Vorschau · Keine Datenspeicherung").length).toBeGreaterThan(0);
  });

  it("checks authorization before rendering the module shell", async () => {
    requirePermission.mockRejectedValue(new Error("Forbidden"));
    await expect(CommunicationPage()).rejects.toThrow("Forbidden");
  });
});
