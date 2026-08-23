// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  vi.stubGlobal("crypto", { randomUUID: () => "idem-1" });
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
    expect(screen.queryByRole("button", { name: "Senden" })).not.toBeInTheDocument();
  });

  it("B — shows the calm empty state and read-only canonical recipient", async () => {
    renderPanel();

    expect(await screen.findByText("Noch keine E-Mails.")).toBeInTheDocument();
    expect(screen.getByText("anna@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText("Betreff")).toBeEnabled();
    expect(screen.getByLabelText("Nachricht")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Senden" })).toBeDisabled();
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
    expect(screen.getByRole("button", { name: "Senden" })).toBeDisabled();
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
    await user.click(screen.getByRole("button", { name: "Senden" }));

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
            direction: "OUTBOUND",
            subject: longSubject,
            body: longBody,
            from: null,
            to: "anna@example.com",
            status: "FAILED",
            senderDisplayName: "Michael Duijster",
            sentAt: null,
            receivedAt: null,
            createdAt: "2026-08-21T10:00:00.000Z",
            deliveryError: "Der E-Mail-Dienst konnte die Nachricht nicht versenden.",
            attachmentCount: 1,
            attachments: [
              {
                id: "attachment-archived",
                filename: "archiv.pdf",
                contentType: "application/pdf",
                size: 1024,
                downloadAvailable: true,
              },
            ],
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
    expect(screen.getByRole("link", { name: "Herunterladen" })).toHaveAttribute(
      "href",
      "/api/tenants/fc-a/communications/attachments/attachment-archived",
    );
    expect(container.querySelector("script")).toBeNull();
    await waitFor(() =>
      expect(screen.getByText("Dieser Eintrag ist abgeschlossen.")).toBeInTheDocument(),
    );
  });

  it("renders mixed FAILED/SENT/RECEIVED items with scoped errors and deterministic order", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/communications/threads?")) {
        return jsonResponse({ thread: { id: "thread-a" } });
      }
      return jsonResponse({
        recipient: baseRecipient,
        messages: [
          {
            id: "m-failed",
            direction: "OUTBOUND",
            subject: "OLD FAIL",
            body: "Fehlversuch",
            from: null,
            to: "anna@example.com",
            status: "FAILED",
            senderDisplayName: "Club Admin",
            sentAt: null,
            receivedAt: null,
            createdAt: "2026-08-21T09:00:00.000Z",
            deliveryError: "Der E-Mail-Dienst konnte die Nachricht nicht versenden.",
            attachmentCount: 0,
          },
          {
            id: "m-sent",
            direction: "OUTBOUND",
            subject: "TEST3",
            body: "Hallo",
            from: null,
            to: "anna@example.com",
            status: "SENT",
            senderDisplayName: "Club Admin",
            sentAt: "2026-08-21T10:00:00.000Z",
            receivedAt: null,
            createdAt: "2026-08-21T09:59:00.000Z",
            deliveryError: null,
            attachmentCount: 0,
          },
          {
            id: "m-in",
            direction: "INBOUND",
            subject: "Re: TEST3",
            body: "Hallo\n\n> quoted",
            from: "m.s.duijster@gmail.com",
            to: null,
            status: "RECEIVED",
            senderDisplayName: null,
            sentAt: null,
            receivedAt: "2026-08-21T10:05:00.000Z",
            createdAt: "2026-08-21T10:06:00.000Z",
            deliveryError: null,
            attachmentCount: 0,
          },
        ],
      });
    });

    const { container } = renderPanel();

    expect(await screen.findByText("Fehlgeschlagen")).toBeInTheDocument();
    expect(screen.getByText("Gesendet")).toBeInTheDocument();
    expect(screen.getByText("Empfangen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Erneut senden" })).toBeInTheDocument();

    expect(screen.getByText("Der E-Mail-Dienst konnte die Nachricht nicht versenden.")).toBeInTheDocument();
    expect(container.querySelectorAll("p.text-rose-600")).toHaveLength(1);

    const headings = Array.from(container.querySelectorAll("h3")).map((node) => node.textContent);
    expect(headings).toEqual(["OLD FAIL", "TEST3", "Re: TEST3"]);
  });

  it("shows 'Erneut senden' only for FAILED outbound emails", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/communications/threads?")) {
        return jsonResponse({ thread: { id: "thread-a" } });
      }
      return jsonResponse({
        recipient: baseRecipient,
        messages: [
          {
            id: "m-failed",
            direction: "OUTBOUND",
            subject: "FAIL",
            body: "Fehlversuch",
            from: null,
            to: "anna@example.com",
            status: "FAILED",
            senderDisplayName: "Club Admin",
            sentAt: null,
            receivedAt: null,
            createdAt: "2026-08-21T09:00:00.000Z",
            deliveryError: "Der E-Mail-Dienst konnte die Nachricht nicht versenden.",
            attachmentCount: 0,
          },
          {
            id: "m-sent",
            direction: "OUTBOUND",
            subject: "SENT",
            body: "Hallo",
            from: null,
            to: "anna@example.com",
            status: "SENT",
            senderDisplayName: "Club Admin",
            sentAt: "2026-08-21T10:00:00.000Z",
            receivedAt: null,
            createdAt: "2026-08-21T09:59:00.000Z",
            deliveryError: null,
            attachmentCount: 0,
          },
          {
            id: "m-in",
            direction: "INBOUND",
            subject: "Re: SENT",
            body: "Hallo",
            from: "someone@example.com",
            to: null,
            status: "RECEIVED",
            senderDisplayName: null,
            sentAt: null,
            receivedAt: "2026-08-21T10:05:00.000Z",
            createdAt: "2026-08-21T10:06:00.000Z",
            deliveryError: null,
            attachmentCount: 0,
          },
        ],
      });
    });

    renderPanel();
    expect(await screen.findByText("FAIL")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Erneut senden" })).toHaveLength(1);
  });

  it("disables retry while pending and refreshes the timeline after success", async () => {
    let historyCalls = 0;
    let resolveRetry: (() => void) | undefined;
    const retryPromise = new Promise<void>((resolve) => {
      resolveRetry = resolve;
    });

    vi.mocked(fetch).mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/communications/threads?")) {
        return jsonResponse({ thread: { id: "thread-a" } });
      }
      if (url.endsWith("/messages/m-failed/retry")) {
        const headerValue = (init?.headers as Record<string, string> | undefined)?.["Idempotency-Key"];
        expect(typeof headerValue).toBe("string");
        expect(String(headerValue || "").trim().length).toBeGreaterThan(0);
        await retryPromise;
        return jsonResponse({ message: { id: "m-retry", status: "SENT" } }, 201);
      }
      if (url.endsWith("/messages")) {
        historyCalls += 1;
        return historyCalls === 1
          ? jsonResponse({
              messages: [
                {
                  id: "m-failed",
                  direction: "OUTBOUND",
                  subject: "FAIL",
                  body: "Fehlversuch",
                  from: null,
                  to: "anna@example.com",
                  status: "FAILED",
                  senderDisplayName: "Club Admin",
                  sentAt: null,
                  receivedAt: null,
                  createdAt: "2026-08-21T09:00:00.000Z",
                  deliveryError: "Der E-Mail-Dienst konnte die Nachricht nicht versenden.",
                  attachmentCount: 0,
                },
              ],
              recipient: baseRecipient,
            })
          : jsonResponse({
              messages: [
                {
                  id: "m-failed",
                  direction: "OUTBOUND",
                  subject: "FAIL",
                  body: "Fehlversuch",
                  from: null,
                  to: "anna@example.com",
                  status: "FAILED",
                  senderDisplayName: "Club Admin",
                  sentAt: null,
                  receivedAt: null,
                  createdAt: "2026-08-21T09:00:00.000Z",
                  deliveryError: "Der E-Mail-Dienst konnte die Nachricht nicht versenden.",
                  attachmentCount: 0,
                },
                {
                  id: "m-retry",
                  direction: "OUTBOUND",
                  subject: "FAIL",
                  body: "Fehlversuch",
                  from: null,
                  to: "anna@example.com",
                  status: "SENT",
                  senderDisplayName: "Club Admin",
                  sentAt: "2026-08-21T10:00:00.000Z",
                  receivedAt: null,
                  createdAt: "2026-08-21T10:00:00.000Z",
                  deliveryError: null,
                  attachmentCount: 0,
                },
              ],
              recipient: baseRecipient,
            });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const user = userEvent.setup();
    renderPanel();

    expect(await screen.findByText("FAIL")).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: "Erneut senden" });
    expect(retryButton).toBeEnabled();

    const clickPromise = user.click(retryButton);
    await waitFor(() => expect(retryButton).toBeDisabled());

    // Double-click protection: retry stays disabled while pending.
    await user.click(retryButton);
    expect(vi.mocked(fetch).mock.calls.filter(([u]) => String(u).includes("/retry"))).toHaveLength(1);

    resolveRetry?.();
    await clickPromise;

    expect(await screen.findByText("Gesendet")).toBeInTheDocument();
    expect(historyCalls).toBeGreaterThanOrEqual(2);
  });

  it("uploads multiple attachments, blocks premature send, removes one, and sends ordered IDs", async () => {
    let resolveSecondUpload: (() => void) | undefined;
    const secondUpload = new Promise<void>((resolve) => {
      resolveSecondUpload = resolve;
    });
    let sentBody: Record<string, unknown> | null = null;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/communications/threads?")) {
        return jsonResponse({ thread: { id: "thread-a" } });
      }
      if (url.endsWith("/communications/attachments")) {
        const file = (init?.body as FormData).get("file") as File;
        if (file.name === "einladung.pdf") await secondUpload;
        return jsonResponse(
          {
            attachment: {
              attachmentId: file.name === "vertrag.pdf" ? "attachment-a" : "attachment-b",
              filename: file.name,
              contentType: file.type,
              size: file.size,
              status: "READY",
              scanStatus: "PENDING",
            },
          },
          201,
        );
      }
      if (url.endsWith("/messages/email")) {
        sentBody = JSON.parse(String(init?.body));
        return jsonResponse({ message: { id: "sent" } }, 201);
      }
      if (url.endsWith("/messages")) {
        return jsonResponse({ messages: [], recipient: baseRecipient });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const user = userEvent.setup();
    renderPanel();
    expect(await screen.findByText("anna@example.com")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Betreff"), "Dokumente");
    await user.type(screen.getByLabelText("Nachricht"), "Im Anhang");
    await user.upload(screen.getByLabelText("Dateien hinzufügen"), [
      new File(["pdf-a"], "vertrag.pdf", { type: "application/pdf" }),
      new File(["pdf-b"], "einladung.pdf", { type: "application/pdf" }),
    ]);

    expect(await screen.findByText("vertrag.pdf")).toBeInTheDocument();
    expect(screen.getByText("einladung.pdf")).toBeInTheDocument();
    expect(screen.getByText(/2\/10/)).toBeInTheDocument();
    expect(screen.getByText(/Wird hochgeladen/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Senden" })).toBeDisabled();

    resolveSecondUpload?.();
    await waitFor(() =>
      expect(screen.queryByText(/Wird hochgeladen/)).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "einladung.pdf entfernen" }));
    expect(screen.queryByText("einladung.pdf")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Senden" }));

    await waitFor(() =>
      expect(sentBody).toMatchObject({ attachmentIds: ["attachment-a"] }),
    );
  });

  it("keeps the open composer usable through the visible picker and a 201 upload", async () => {
    let resolveUpload: (() => void) | undefined;
    const upload = new Promise<void>((resolve) => {
      resolveUpload = resolve;
    });
    let uploadCount = 0;
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/communications/threads?")) {
        return jsonResponse({ thread: { id: "thread-a" } });
      }
      if (url.endsWith("/messages")) {
        return jsonResponse({ messages: [], recipient: baseRecipient });
      }
      if (url.endsWith("/communications/attachments")) {
        uploadCount += 1;
        if (uploadCount === 1) await upload;
        return jsonResponse({
          attachment: {
            attachmentId: `attachment-focus-${uploadCount}`,
            filename: "focus.pdf",
            contentType: "application/pdf",
            size: 1_536,
            status: "READY",
            scanStatus: "PENDING",
          },
        }, 201);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const user = userEvent.setup();
    const { container } = render(
      <div role="dialog" aria-modal="true" aria-label="Anmeldungsdetails">
        {panel()}
      </div>,
    );
    expect(await screen.findByText("anna@example.com")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Betreff"), "Dokumente");
    await user.type(screen.getByLabelText("Nachricht"), "Im Anhang");

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    if (!input) throw new Error("File input is missing.");
    const addButton = screen.getByRole("button", { name: "Datei hinzufügen" });
    const openPicker = vi.spyOn(input, "click");
    const focusButton = vi.spyOn(addButton, "focus");

    await user.click(addButton);
    expect(openPicker).toHaveBeenCalledOnce();
    input.focus();

    fireEvent.change(input, {
      target: {
        files: [new File(["pdf"], "focus.pdf", { type: "application/pdf" })],
      },
    });
    expect(focusButton).toHaveBeenCalledWith({ preventScroll: true });
    expect(addButton).toHaveFocus();
    expect(input.value).toBe("");
    expect(screen.getByText("focus.pdf")).toBeInTheDocument();
    expect(screen.getByText(/Wird hochgeladen/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Dokumente")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Im Anhang")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Senden" })).toBeDisabled();

    resolveUpload?.();
    await screen.findByText(/Bereit/);
    expect(addButton).toHaveFocus();
    expect(screen.getByLabelText("E-Mail verfassen")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Dokumente")).toBeEnabled();
    expect(screen.getByDisplayValue("Im Anhang")).toBeEnabled();
    expect(screen.getByLabelText("Ausgewählte Anhänge")).toHaveTextContent("2 KB");
    expect(screen.getByRole("button", { name: "Senden" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "E-Mail-Editor schliessen" })).toBeEnabled();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(container.querySelectorAll('[aria-modal="true"]')).toHaveLength(1);

    await user.type(screen.getByLabelText("Nachricht"), " – ergänzt");
    expect(screen.getByDisplayValue("Im Anhang – ergänzt")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "focus.pdf entfernen" }));
    expect(screen.queryByText("focus.pdf")).not.toBeInTheDocument();

    await user.click(addButton);
    fireEvent.change(input, {
      target: {
        files: [new File(["pdf"], "focus.pdf", { type: "application/pdf" })],
      },
    });
    await screen.findByText(/Bereit/);
    expect(uploadCount).toBe(2);
    expect(screen.getByText("focus.pdf")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Dokumente")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Im Anhang – ergänzt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Senden" })).toBeEnabled();
  });

  it("keeps the composer usable and permits same-file retry after upload failure", async () => {
    let uploadCount = 0;
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/communications/threads?")) {
        return jsonResponse({ thread: { id: "thread-a" } });
      }
      if (url.endsWith("/messages")) {
        return jsonResponse({ messages: [], recipient: baseRecipient });
      }
      if (url.endsWith("/communications/attachments")) {
        uploadCount += 1;
        return uploadCount === 1
          ? jsonResponse({ error: "Die Datei konnte nicht hochgeladen werden." }, 500)
          : jsonResponse({
              attachment: {
                attachmentId: "attachment-retry",
                filename: "erneut.pdf",
                contentType: "application/pdf",
                size: 3,
                status: "READY",
                scanStatus: "PENDING",
              },
            }, 201);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const user = userEvent.setup();
    const { container } = renderPanel();
    expect(await screen.findByText("anna@example.com")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Betreff"), "Fehlerfall");
    await user.type(screen.getByLabelText("Nachricht"), "Bleibt erhalten");
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    if (!input) throw new Error("File input is missing.");
    const file = new File(["pdf"], "erneut.pdf", { type: "application/pdf" });

    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText(/Die Datei konnte nicht hochgeladen werden/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Fehlerfall")).toBeEnabled();
    expect(screen.getByDisplayValue("Bleibt erhalten")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Datei hinzufügen" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "erneut.pdf entfernen" }));
    fireEvent.change(input, { target: { files: [file] } });
    await screen.findByText(/Bereit/);
    expect(uploadCount).toBe(2);
    expect(screen.getByText("erneut.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Senden" })).toBeEnabled();
  });

  it("renders secure relational downloads and explicit legacy metadata fallback", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/communications/threads?")) {
        return jsonResponse({ thread: { id: "thread-a" } });
      }
      return jsonResponse({
        recipient: baseRecipient,
        messages: [
          {
            id: "m-sent",
            direction: "OUTBOUND",
            subject: "Mit Anhängen",
            body: "Siehe Anhang",
            from: null,
            to: "anna@example.com",
            status: "SENT",
            senderDisplayName: "Club Admin",
            sentAt: "2026-08-21T10:00:00.000Z",
            receivedAt: null,
            createdAt: "2026-08-21T10:00:00.000Z",
            deliveryError: null,
            attachmentCount: 2,
            attachments: [
              {
                id: "attachment-a",
                filename: "vertrag.pdf",
                contentType: "application/pdf",
                size: 1234,
                downloadAvailable: true,
              },
              {
                id: "legacy-a",
                filename: "legacy.pdf",
                contentType: "application/pdf",
                size: 99,
                downloadAvailable: false,
              },
            ],
          },
        ],
      });
    });

    renderPanel();
    const download = await screen.findByRole("link", { name: "Herunterladen" });
    expect(download).toHaveAttribute(
      "href",
      "/api/tenants/fc-a/communications/attachments/attachment-a",
    );
    expect(screen.getByText(/vertrag\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/legacy\.pdf/)).toBeInTheDocument();
    expect(screen.getByText("Nur Metadaten verfügbar")).toBeInTheDocument();
  });

  it("shows client-side size validation before starting an upload", async () => {
    const user = userEvent.setup();
    renderPanel();
    expect(await screen.findByText("anna@example.com")).toBeInTheDocument();
    const oversized = new File(["x"], "zu-gross.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(oversized, "size", { value: 10 * 1024 * 1024 + 1 });
    await user.upload(screen.getByLabelText("Dateien hinzufügen"), oversized);

    expect(screen.getByText("Die Datei überschreitet 10 MiB.")).toBeInTheDocument();
    expect(
      vi.mocked(fetch).mock.calls.some(([url]) =>
        String(url).endsWith("/communications/attachments"),
      ),
    ).toBe(false);
  });

  it("exposes the same shared attachment composer for Waiting List communication", async () => {
    renderPanel({ targetType: "WAITING_LIST_ENTRY", targetId: "wait-a" });

    expect(await screen.findByText("anna@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText("Dateien hinzufügen")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Entwurf speichern" })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("targetType=WAITING_LIST_ENTRY"),
      expect.anything(),
    );
  });

  it("creates one draft, updates the same explicit ID, and never calls the provider send route", async () => {
    const savedBodies: Array<{ url: string; method: string; body: Record<string, unknown> }> = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/communications/threads?")) {
        return jsonResponse({ thread: { id: "thread-a" } });
      }
      if (url.endsWith("/messages")) {
        return jsonResponse({ messages: [], draft: null, recipient: baseRecipient });
      }
      if (url.endsWith("/drafts") || url.endsWith("/drafts/draft-a")) {
        const body = JSON.parse(String(init?.body));
        savedBodies.push({ url, method: String(init?.method), body });
        return jsonResponse(
          {
            draft: {
              id: "draft-a",
              direction: "OUTBOUND",
              subject: body.subject,
              body: body.bodyText,
              from: null,
              to: "anna@example.com",
              status: "DRAFT",
              senderDisplayName: "Admin",
              sentAt: null,
              receivedAt: null,
              createdAt: "2026-08-23T05:00:00.000Z",
              updatedAt: "2026-08-23T05:15:00.000Z",
              deliveryError: null,
              attachmentCount: 0,
              attachments: [],
            },
          },
          url.endsWith("/drafts") ? 201 : 200,
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const user = userEvent.setup();
    renderPanel();
    expect(await screen.findByText("anna@example.com")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Betreff"), "Trainingsanmeldung");
    await user.type(screen.getByLabelText("Nachricht"), "Hallo Anna");
    await user.click(screen.getByRole("button", { name: "Entwurf speichern" }));

    expect(await screen.findByText("Entwurf gespeichert")).toBeInTheDocument();
    expect(screen.getByText("Entwurf")).toBeInTheDocument();
    expect(savedBodies[0]).toMatchObject({
      method: "POST",
      body: { subject: "Trainingsanmeldung", bodyText: "Hallo Anna", attachmentIds: [] },
    });

    await user.type(screen.getByLabelText("Betreff"), " aktualisiert");
    await user.click(screen.getByRole("button", { name: "Entwurf speichern" }));
    expect(await screen.findByText("Änderungen gespeichert")).toBeInTheDocument();
    expect(savedBodies[1]).toMatchObject({
      method: "PATCH",
      url: expect.stringContaining("/drafts/draft-a"),
    });
    expect(
      vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith("/messages/email")),
    ).toBe(false);
  });

  it("reopens a draft with ordered attachment metadata and sends that same message", async () => {
    let sentBody: Record<string, unknown> | null = null;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/communications/threads?")) {
        return jsonResponse({ thread: { id: "thread-a" } });
      }
      if (url.endsWith("/drafts/draft-a/send")) {
        sentBody = JSON.parse(String(init?.body));
        return jsonResponse({ message: { id: "draft-a", status: "SENT" } });
      }
      if (url.endsWith("/messages")) {
        return jsonResponse({
          messages: [],
          recipient: baseRecipient,
          draft: {
            id: "draft-a",
            direction: "OUTBOUND",
            subject: "Gespeicherter Betreff",
            body: "Gespeicherter Inhalt",
            from: null,
            to: "anna@example.com",
            status: "DRAFT",
            senderDisplayName: "Admin",
            sentAt: null,
            receivedAt: null,
            createdAt: "2026-08-23T05:00:00.000Z",
            updatedAt: "2026-08-23T05:15:00.000Z",
            deliveryError: null,
            attachmentCount: 2,
            attachments: [
              {
                id: "attachment-b",
                filename: "b.pdf",
                contentType: "application/pdf",
                size: 2,
                downloadAvailable: true,
              },
              {
                id: "attachment-a",
                filename: "a.pdf",
                contentType: "application/pdf",
                size: 1,
                downloadAvailable: true,
              },
            ],
          },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const user = userEvent.setup();
    renderPanel();

    expect(await screen.findByDisplayValue("Gespeicherter Betreff")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Gespeicherter Inhalt")).toBeInTheDocument();
    expect(screen.getAllByText(/\.pdf/).map((node) => node.textContent)).toEqual([
      expect.stringContaining("b.pdf"),
      expect.stringContaining("a.pdf"),
    ]);
    expect(screen.getByRole("button", { name: "Entwurf speichern" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Senden" }));
    await waitFor(() =>
      expect(sentBody).toMatchObject({
        subject: "Gespeicherter Betreff",
        bodyText: "Gespeicherter Inhalt",
        attachmentIds: ["attachment-b", "attachment-a"],
      }),
    );
  });

  it("warns only for dirty composer closes and clears dirty state after save", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/communications/threads?")) {
        return jsonResponse({ thread: { id: "thread-a" } });
      }
      if (url.endsWith("/messages")) {
        return jsonResponse({ messages: [], draft: null, recipient: baseRecipient });
      }
      if (url.endsWith("/drafts")) {
        const body = JSON.parse(String(init?.body));
        return jsonResponse({
          draft: {
            id: "draft-a",
            direction: "OUTBOUND",
            subject: body.subject,
            body: body.bodyText,
            from: null,
            to: "anna@example.com",
            status: "DRAFT",
            senderDisplayName: "Admin",
            sentAt: null,
            receivedAt: null,
            createdAt: "2026-08-23T05:00:00.000Z",
            updatedAt: "2026-08-23T05:00:00.000Z",
            deliveryError: null,
            attachmentCount: 0,
            attachments: [],
          },
        }, 201);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const user = userEvent.setup();
    renderPanel();
    expect(await screen.findByText("anna@example.com")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Betreff"), "Entwurf");
    await user.type(screen.getByLabelText("Nachricht"), "Inhalt");

    await user.click(screen.getByRole("button", { name: "E-Mail-Editor schliessen" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Betreff")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Entwurf speichern" }));
    expect(await screen.findByText("Entwurf gespeichert")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "E-Mail-Editor schliessen" }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Betreff")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Weiter bearbeiten" })).toBeInTheDocument();
  });
});
