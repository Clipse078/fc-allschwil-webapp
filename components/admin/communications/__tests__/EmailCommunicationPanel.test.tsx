// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

function panel(overrides: Partial<ComponentProps<typeof EmailCommunicationPanel>> = {}) {
  return (
    <EmailCommunicationPanel
      tenantSlug="fc-a"
      targetType="REGISTRATION"
      targetId="reg-a"
      canEdit
      lifecycleAllowsSend
      {...overrides}
    />
  );
}

function renderPanel(overrides: Partial<ComponentProps<typeof EmailCommunicationPanel>> = {}) {
  return render(panel(overrides));
}

describe("COMM-01C email communication UX", () => {
  it("A — isolates a history API failure from empty and recipient states", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/communications/threads?")) {
        return jsonResponse({ thread: { id: "thread-a" } });
      }
      return jsonResponse({ error: "E-Mail-Verlauf konnte nicht geladen werden." }, 500);
    });

    renderPanel();

    expect(await screen.findByText("E-Mail-Verlauf konnte nicht geladen werden.")).toBeInTheDocument();
    expect(screen.getByText("Bitte versuche es erneut.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Erneut versuchen" })).toBeInTheDocument();
    expect(screen.queryByText("Noch keine E-Mails.")).not.toBeInTheDocument();
    expect(screen.queryByText("Keine E-Mail-Adresse verfügbar")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Betreff")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "E-Mail senden" })).not.toBeInTheDocument();
  });

  it("B — shows the calm empty state and read-only canonical recipient", async () => {
    renderPanel();

    expect(await screen.findByText("Noch keine E-Mails.")).toBeInTheDocument();
    expect(screen.getByText("anna@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText("Betreff")).toBeEnabled();
    expect(screen.getByLabelText("Nachricht")).toBeEnabled();
    expect(screen.getByRole("button", { name: "E-Mail senden" })).toBeDisabled();
  });

  it("C — blocks composing when the canonical target has no recipient", async () => {
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

  it("D — preserves loaded context when sending fails", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/communications/threads?")) {
        return jsonResponse({ thread: { id: "thread-a" } });
      }
      if (url.endsWith("/messages/email")) {
        return jsonResponse({ error: "Die E-Mail konnte nicht gesendet werden." }, 502);
      }
      if (url.endsWith("/messages")) {
        return jsonResponse({ messages: [], recipient: baseRecipient });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const user = userEvent.setup();
    renderPanel();

    expect(await screen.findByText("anna@example.com")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Betreff"), "Willkommen");
    await user.type(screen.getByLabelText("Nachricht"), "Hallo Anna");
    await user.click(screen.getByRole("button", { name: "E-Mail senden" }));

    expect(await screen.findByText("Die E-Mail konnte nicht gesendet werden.")).toBeInTheDocument();
    expect(screen.getByText("anna@example.com")).toBeInTheDocument();
    expect(screen.getByText("Noch keine E-Mails.")).toBeInTheDocument();
    expect(screen.getByLabelText("Betreff")).toBeEnabled();
    expect(screen.queryByText("Bitte versuche es erneut.")).not.toBeInTheDocument();
  });

  it("E — replaces an initial load error with successful state after retry", async () => {
    let historyAttempts = 0;
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/communications/threads?")) {
        return jsonResponse({ thread: { id: "thread-a" } });
      }
      if (url.endsWith("/messages")) {
        historyAttempts += 1;
        return historyAttempts === 1
          ? jsonResponse({ error: "E-Mail-Verlauf konnte nicht geladen werden." }, 500)
          : jsonResponse({ messages: [], recipient: baseRecipient });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const user = userEvent.setup();
    renderPanel();

    expect(await screen.findByText("E-Mail-Verlauf konnte nicht geladen werden.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Erneut versuchen" }));

    expect(await screen.findByText("anna@example.com")).toBeInTheDocument();
    expect(screen.getByText("Noch keine E-Mails.")).toBeInTheDocument();
    expect(screen.queryByText("E-Mail-Verlauf konnte nicht geladen werden.")).not.toBeInTheDocument();
    expect(screen.queryByText("Bitte versuche es erneut.")).not.toBeInTheDocument();
  });

  it("F — ignores a stale history response after the target changes", async () => {
    let resolveRegistrationA: ((response: Response) => void) | undefined;
    const registrationAHistory = new Promise<Response>((resolve) => {
      resolveRegistrationA = resolve;
    });

    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/communications/threads?")) {
        const targetId = new URL(url, "http://localhost").searchParams.get("targetId");
        return jsonResponse({ thread: { id: targetId === "reg-a" ? "thread-a" : "thread-b" } });
      }
      if (url.includes("/threads/thread-a/messages")) {
        return registrationAHistory;
      }
      if (url.includes("/threads/thread-b/messages")) {
        return jsonResponse({
          messages: [],
          recipient: { ...baseRecipient, email: "berta@example.com", displayName: "Berta Beispiel" },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const view = renderPanel();
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/threads/thread-a/messages"),
        expect.anything(),
      ),
    );

    view.rerender(panel({ targetId: "reg-b" }));
    expect(await screen.findByText("berta@example.com")).toBeInTheDocument();

    resolveRegistrationA?.(
      jsonResponse({
        messages: [],
        recipient: { ...baseRecipient, email: "anna@example.com" },
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("berta@example.com")).toBeInTheDocument();
      expect(screen.queryByText("anna@example.com")).not.toBeInTheDocument();
      expect(screen.queryByText("E-Mail-Verlauf konnte nicht geladen werden.")).not.toBeInTheDocument();
    });
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
