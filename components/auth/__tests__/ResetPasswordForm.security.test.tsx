// @vitest-environment jsdom

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ""} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function jsonResult(data: unknown, ok = true) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(data),
  };
}

describe("ResetPasswordForm token history hardening", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("scrubs a reset token while retaining it in memory for submission", async () => {
    const token = "reset-browser-token";
    window.history.replaceState(
      {},
      "",
      `/reset-password?token=${token}#sensitive-fragment`,
    );

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResult({ valid: true, isInvitation: false }),
      )
      .mockResolvedValueOnce(jsonResult({}));
    vi.stubGlobal("fetch", fetchMock);

    render(<ResetPasswordForm />);

    await waitFor(() => {
      expect(window.location.href).toBe("http://localhost:3000/reset-password");
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `/api/auth/reset-password?token=${token}`,
    );

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Neues Passwort"), "secure-value-123");
    await user.type(
      screen.getByLabelText("Passwort bestätigen"),
      "secure-value-123",
    );
    await user.click(
      screen.getByRole("button", { name: "Passwort speichern" }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      token,
    });
    expect(window.localStorage).toHaveLength(0);
    expect(window.sessionStorage).toHaveLength(0);
  });

  it("scrubs an invitation token while retaining it for acceptance", async () => {
    const token = "invitation-browser-token";
    window.history.replaceState({}, "", `/reset-password?token=${token}`);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResult({
          valid: true,
          isInvitation: true,
          isExistingUser: true,
          tenantName: "FC Test",
          recipientFirstName: "Alex",
        }),
      )
      .mockResolvedValueOnce(jsonResult({}));
    vi.stubGlobal("fetch", fetchMock);

    render(<ResetPasswordForm />);

    await waitFor(() => {
      expect(window.location.search).toBe("");
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Einladung annehmen" }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      token,
    });
    expect(window.localStorage).toHaveLength(0);
    expect(window.sessionStorage).toHaveLength(0);
  });
});
