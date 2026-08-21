// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { EmailCommunicationPanel } from "@/components/admin/communications/EmailCommunicationPanel";

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

const baseRecipient = {
  email: "anna@example.com",
  displayName: "Anna Muster",
  available: true,
  sendAllowed: true,
  unavailableReason: null,
};

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/communications/threads?")) {
        return jsonResponse({ thread: { id: "thread-a" } });
      }
      if (url.endsWith("/messages")) {
        return jsonResponse({ messages: [], recipient: baseRecipient });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPanel(overrides: Partial<ComponentProps<typeof EmailCommunicationPanel>> = {}) {
  return render(
    <EmailCommunicationPanel
      tenantSlug="fc-a"
      targetType="REGISTRATION"
      targetId="reg-a"
      canEdit
      lifecycleAllowsSend
      {...overrides}
    />,
  );
}

describe("COMM-01C email communication UX", () => {
  it("shows the calm empty state and read-only canonical recipient", async () => {
    renderPanel();

    expect(await screen.findByText("Noch keine E-Mails.")).toBeInTheDocument();
    expect(screen.getByText("anna@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText("Betreff")).toBeEnabled();
    expect(screen.getByLabelText("Nachricht")).toBeEnabled();
    expect(screen.getByRole("button", { name: "E-Mail senden" })).toBeDisabled();
  });

  it("blocks composing when the canonical target has no recipient", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/communications/threads?")) {
        return jsonResponse({ thread: { id: "thread-a" } });
      }
      return jsonResponse({
        messages: [],
        recipient: {
          email: null,
          displayName: "Anna Muster",
          available: false,
          sendAllowed: false,
          unavailableReason: "Für diese Person ist keine gültige E-Mail-Adresse verfügbar.",
        },
      });
    });

    renderPanel();

    expect(await screen.findByText("Keine E-Mail-Adresse verfügbar")).toBeInTheDocument();
    expect(screen.getByText("Für diese Person ist keine gültige E-Mail-Adresse verfügbar.")).toBeInTheDocument();
    expect(screen.getByLabelText("Betreff")).toBeDisabled();
    expect(screen.getByRole("button", { name: "E-Mail senden" })).toBeDisabled();
  });

  it("surfaces non-404 thread lookup failures instead of presenting empty history", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: "Keine Berechtigung." }, 403),
    );

    renderPanel();

    expect(await screen.findByText("Keine Berechtigung.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Erneut versuchen" })).toBeInTheDocument();
    expect(screen.queryByText("Noch keine E-Mails.")).not.toBeInTheDocument();
  });

  it("renders failed long-form history safely and keeps terminal entries read-only", async () => {
    const longSubject = "Sehr langer Betreff ".repeat(12);
    const longBody = "<script>alert('x')</script>\n" + "Langer Nachrichtentext ".repeat(30);
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/communications/threads?")) {
        return jsonResponse({ thread: { id: "thread-a" } });
      }
      return jsonResponse({
        recipient: {
          ...baseRecipient,
          sendAllowed: false,
          unavailableReason: "Dieser Eintrag ist abgeschlossen.",
        },
        messages: [
          {
            id: "message-a",
            subject: longSubject,
            body: longBody,
            recipient: "anna@example.com",
            status: "FAILED",
            senderDisplayName: "Michael Duijster",
            sentAt: null,
            createdAt: "2026-08-21T10:00:00.000Z",
            deliveryError: "Der E-Mail-Dienst konnte die Nachricht nicht versenden.",
          },
        ],
      });
    });

    const { container } = renderPanel({ lifecycleAllowsSend: false });

    expect(await screen.findByText("Fehlgeschlagen")).toBeInTheDocument();
    expect(container.querySelector("h3")?.textContent).toBe(longSubject);
    expect(container.querySelector("p.whitespace-pre-wrap")?.textContent).toBe(longBody);
    expect(screen.getByText(/Michael Duijster/)).toBeInTheDocument();
    expect(screen.getByLabelText("Nachricht")).toBeDisabled();
    expect(container.querySelector("script")).toBeNull();
    await waitFor(() =>
      expect(screen.getByText("Dieser Eintrag ist abgeschlossen.")).toBeInTheDocument(),
    );
  });
});
