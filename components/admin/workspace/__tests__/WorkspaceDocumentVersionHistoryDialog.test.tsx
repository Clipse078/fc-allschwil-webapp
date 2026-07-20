/**
 * @vitest-environment jsdom
 */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { WorkspaceDocumentVersionHistoryDialog } from "@/components/admin/workspace/WorkspaceDocumentVersionHistoryDialog";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) =>
    (key: string, _params?: Record<string, unknown>) => `${namespace}.${key}`,
}));

const DOCUMENT_ID = "document-1";

function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function renderDialog(
  overrides: {
    open?: boolean;
    onClose?: () => void;
  } = {},
) {
  const onClose = overrides.onClose ?? vi.fn();

  render(
    <WorkspaceDocumentVersionHistoryDialog
      documentId={DOCUMENT_ID}
      documentName="Trainer handbook"
      open={overrides.open ?? true}
      onClose={onClose}
    />,
  );

  return {
    onClose,
  };
}

describe("WorkspaceDocumentVersionHistoryDialog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a loading state while versions are requested", async () => {
    let resolveFetch:
      | ((value: Response) => void)
      | undefined;

    const pendingFetch = new Promise<Response>(
      (resolve) => {
        resolveFetch = resolve;
      },
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(() => pendingFetch),
    );

    renderDialog();

    expect(
      screen.getByRole("status", {
        name: "Workspace.versionHistory.loadingAriaLabel",
      }),
    ).toBeTruthy();

    await act(async () => {
      resolveFetch?.(
        jsonResponse({
          versions: [],
        }),
      );

      await pendingFetch;
    });
  });

  it("renders version rows and the current badge", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          versions: [
            {
              id: "version-2",
              versionNumber: 2,
              createdAt:
                "2026-07-18T12:00:00.000Z",
              createdByUserId: "user-2",
              createdByName: "Michael",
              filename: "trainer-handbook-v2.pdf",
              mimeType: "application/pdf",
              sizeBytes: 2048,
              checksum: "checksum-2",
              status: "CURRENT",
              isCurrent: true,
            },
            {
              id: "version-1",
              versionNumber: 1,
              createdAt:
                "2026-07-17T12:00:00.000Z",
              createdByUserId: "user-1",
              createdByName: null,
              filename: "trainer-handbook.pdf",
              mimeType: "application/pdf",
              sizeBytes: 1024,
              checksum: "checksum-1",
              status: "SUPERSEDED",
              isCurrent: false,
            },
          ],
        }),
      ),
    );

    renderDialog();

    expect(
      await screen.findByText("v2"),
    ).toBeTruthy();

    expect(
      screen.getByText("v1"),
    ).toBeTruthy();

    expect(
      screen.getByText("Michael"),
    ).toBeTruthy();

    expect(
      screen.getByText("trainer-handbook-v2.pdf"),
    ).toBeTruthy();

    expect(
      screen.getByText("2.0 KB"),
    ).toBeTruthy();

    expect(
      screen.getByText("Workspace.versionHistory.statusCurrent"),
    ).toBeTruthy();

    expect(
      screen.getByText("Workspace.versionHistory.statusSuperseded"),
    ).toBeTruthy();
  });

  it("shows the empty state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          versions: [],
        }),
      ),
    );

    renderDialog();

    expect(
      await screen.findByText(
        "Workspace.versionHistory.noVersions",
      ),
    ).toBeTruthy();
  });

  it("shows an error returned by the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: "Document not found.",
          },
          404,
        ),
      ),
    );

    renderDialog();

    expect(
      await screen.findByRole("alert"),
    ).toBeTruthy();

    expect(
      screen.getByText("Document not found."),
    ).toBeTruthy();

    expect(
      screen.getByRole("button", {
        name: "Workspace.versionHistory.retryButton",
      }),
    ).toBeTruthy();
  });

  it("retries the version request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: "Temporary failure.",
          },
          500,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          versions: [],
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    renderDialog();

    const retryButton =
      await screen.findByRole("button", {
        name: "Workspace.versionHistory.retryButton",
      });

    fireEvent.click(retryButton);

    expect(
      await screen.findByText(
        "Workspace.versionHistory.noVersions",
      ),
    ).toBeTruthy();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not render when closed", () => {
    vi.stubGlobal("fetch", vi.fn());

    renderDialog({
      open: false,
    });

    expect(
      screen.queryByRole("dialog"),
    ).toBeNull();

    expect(fetch).not.toHaveBeenCalled();
  });

  it("calls onClose from the footer close button", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          versions: [],
        }),
      ),
    );

    const onClose = vi.fn();

    renderDialog({
      onClose,
    });

    await screen.findByText(
      "Workspace.versionHistory.noVersions",
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Workspace.versionHistory.closeButton",
      }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          versions: [],
        }),
      ),
    );

    const onClose = vi.fn();

    renderDialog({
      onClose,
    });

    await screen.findByText(
      "Workspace.versionHistory.noVersions",
    );

    fireEvent.keyDown(document, {
      key: "Escape",
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});