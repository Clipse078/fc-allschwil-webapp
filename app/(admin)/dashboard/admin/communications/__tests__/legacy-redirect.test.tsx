import { describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect }));

import CommunicationsSettingsPage from "../page";

describe("legacy communications settings route", () => {
  it("redirects to the canonical Kommunikation sender route", async () => {
    await CommunicationsSettingsPage();
    expect(redirect).toHaveBeenCalledWith("/dashboard/communication/email-sender");
  });
});
