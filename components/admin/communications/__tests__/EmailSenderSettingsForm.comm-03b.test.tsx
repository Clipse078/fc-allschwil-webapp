// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const toastSuccess = vi.fn();
const toastDanger = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: {
      success: toastSuccess,
      danger: toastDanger,
    },
  }),
}));

import EmailSenderSettingsForm from "../EmailSenderSettingsForm";

const configured = {
  displayName: "FC Allschwil",
  emailAddress: "info@fcallschwil.ch",
  providerStatus: "VERIFIED" as const,
  activeSource: "TENANT" as const,
  activeFrom: "FC Allschwil <info@fcallschwil.ch>",
  platformFallbackActive: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

describe("COMM-03B email sender settings UI", () => {
  it("renders tenant-wide sender fields and Reply-To explanation", () => {
    render(<EmailSenderSettingsForm initialSettings={configured} />);
    expect(screen.getByLabelText("Absendername")).toHaveValue("FC Allschwil");
    expect(screen.getByLabelText("Absender-E-Mail")).toHaveValue("info@fcallschwil.ch");
    expect(screen.getByText("Verifiziert")).toBeInTheDocument();
    expect(screen.getByText(/Antworten werden weiterhin automatisch/)).toBeInTheDocument();
  });

  it("shows unverified platform fallback state", () => {
    render(
      <EmailSenderSettingsForm
        initialSettings={{
          ...configured,
          providerStatus: "NOT_VERIFIED",
          activeSource: "PLATFORM",
          activeFrom: "SportClubEvo <noreply@mail.sportclubevo.com>",
          platformFallbackActive: true,
        }}
      />,
    );
    expect(screen.getByText("Nicht verifiziert")).toBeInTheDocument();
    expect(screen.getByText("Plattform-Absender aktiv")).toBeInTheDocument();
    expect(screen.getByText(/Bis zur Verifizierung/)).toBeInTheDocument();
  });

  it("edits and saves sender identity without a client tenantId", async () => {
    const updated = {
      ...configured,
      displayName: "Neuer Club",
      emailAddress: "mail@neuer-club.ch",
    };
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ settings: updated }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    render(<EmailSenderSettingsForm initialSettings={configured} />);

    fireEvent.change(screen.getByLabelText("Absendername"), {
      target: { value: "Neuer Club" },
    });
    fireEvent.change(screen.getByLabelText("Absender-E-Mail"), {
      target: { value: "mail@neuer-club.ch" },
    });
    fireEvent.click(screen.getByRole("button", { name: "E-Mail-Absender speichern" }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(
      "E-Mail-Absender aktualisiert.",
    ));
    const [, options] = vi.mocked(fetch).mock.calls[0]!;
    expect(JSON.parse(String(options?.body))).toEqual({
      displayName: "Neuer Club",
      emailAddress: "mail@neuer-club.ch",
    });
  });

  it("does not expose technical Reply-To configuration", () => {
    render(<EmailSenderSettingsForm initialSettings={configured} />);
    expect(screen.queryByLabelText(/Reply-To/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/reply\+/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/EMAIL_INBOUND_DOMAIN/i)).not.toBeInTheDocument();
  });
});
