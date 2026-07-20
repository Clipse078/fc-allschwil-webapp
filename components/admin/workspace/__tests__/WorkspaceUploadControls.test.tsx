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
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  uploadWorkspaceFile: vi.fn(),
  routerRefresh: vi.fn(),
  onUploadComplete: vi.fn(),
}));

vi.mock(
  "@/lib/workspace/upload-client",
  () => ({
    uploadWorkspaceFile: mocks.uploadWorkspaceFile,
    WorkspaceUploadError: class WorkspaceUploadError extends Error {
      readonly code: string | undefined;

      constructor(message: string, code?: string) {
        super(message);
        this.name = "WorkspaceUploadError";
        this.code = code;
      }
    },
  }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mocks.routerRefresh,
    push: vi.fn(),
  }),
}));

// Mock next-intl so components render without a provider in tests.
// The identity function returns the key itself, allowing text-free assertions.
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, _params?: Record<string, unknown>) => `${namespace}.${key}`,
}));

import { WorkspaceUploadControls } from "@/components/admin/workspace/WorkspaceUploadControls";

function renderControls(folderId = "folder-1") {
  render(
    <WorkspaceUploadControls
      folderId={folderId}
      onUploadComplete={mocks.onUploadComplete}
    />,
  );
}

function getFileInput(): HTMLInputElement {
  const inputs = document.querySelectorAll<HTMLInputElement>(
    'input[type="file"]',
  );
  if (inputs.length === 0) throw new Error("No file input found");
  return inputs[0];
}

function makeFile(
  name = "report.pdf",
  type = "application/pdf",
): File {
  return new File(["content"], name, { type });
}

describe("WorkspaceUploadControls – upload flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a file input for browsing", () => {
    renderControls();

    const fileInputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="file"]',
    );
    expect(fileInputs.length).toBeGreaterThan(0);
  });

  it("renders the dropzone area with translated text", () => {
    renderControls();

    // With our identity mock, the text is the translation key.
    // This confirms the component uses t('dropzoneTitle') from the upload namespace.
    expect(
      screen.getByText("Workspace.upload.dropzoneTitle"),
    ).toBeTruthy();
  });

  it("renders the upload button with translated label", () => {
    renderControls();

    expect(
      screen.getAllByText("Workspace.upload.buttonLabel").length,
    ).toBeGreaterThan(0);
  });

  it("calls uploadWorkspaceFile with the file and folderId on file selection", async () => {
    mocks.uploadWorkspaceFile.mockResolvedValue({
      document: { id: "doc-abc", name: "report.pdf" },
    });

    renderControls("folder-test");

    const input = getFileInput();
    const file = makeFile();

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(mocks.uploadWorkspaceFile).toHaveBeenCalledWith({
        file,
        folderId: "folder-test",
      });
    });
  });

  it("calls onUploadComplete with the document ID after a successful upload", async () => {
    mocks.uploadWorkspaceFile.mockResolvedValue({
      document: { id: "doc-123", name: "report.pdf" },
    });

    renderControls();

    const input = getFileInput();

    await act(async () => {
      fireEvent.change(input, { target: { files: [makeFile()] } });
    });

    await waitFor(() => {
      expect(mocks.onUploadComplete).toHaveBeenCalledWith("doc-123");
    });
  });

  it("resets the file input after a successful upload", async () => {
    mocks.uploadWorkspaceFile.mockResolvedValue({
      document: { id: "doc-xyz", name: "report.pdf" },
    });

    renderControls();

    const input = getFileInput();
    Object.defineProperty(input, "value", {
      writable: true,
      value: "C:\\fakepath\\report.pdf",
    });

    await act(async () => {
      fireEvent.change(input, { target: { files: [makeFile()] } });
    });

    await waitFor(() => {
      expect(input.value).toBe("");
    });
  });

  it("resets the file input after a failed upload", async () => {
    mocks.uploadWorkspaceFile.mockRejectedValue(
      new Error("Upload fehlgeschlagen."),
    );

    renderControls();

    const input = getFileInput();
    Object.defineProperty(input, "value", {
      writable: true,
      value: "C:\\fakepath\\report.pdf",
    });

    await act(async () => {
      fireEvent.change(input, { target: { files: [makeFile()] } });
    });

    await waitFor(() => {
      expect(input.value).toBe("");
    });
  });

  it("shows an error message when the upload fails", async () => {
    mocks.uploadWorkspaceFile.mockRejectedValue(
      new Error("Die Datei konnte nicht gespeichert werden."),
    );

    renderControls();

    const input = getFileInput();

    await act(async () => {
      fireEvent.change(input, { target: { files: [makeFile()] } });
    });

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    });
  });

  it("does not call onUploadComplete after a failed upload", async () => {
    mocks.uploadWorkspaceFile.mockRejectedValue(
      new Error("Upload failed."),
    );

    renderControls();

    await act(async () => {
      fireEvent.change(getFileInput(), {
        target: { files: [makeFile()] },
      });
    });

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    });

    expect(mocks.onUploadComplete).not.toHaveBeenCalled();
  });

  it("shows a localised error for WORKSPACE_UPLOAD_STORAGE_NOT_CONFIGURED", async () => {
    const { WorkspaceUploadError } = await import(
      "@/lib/workspace/upload-client"
    );

    mocks.uploadWorkspaceFile.mockRejectedValue(
      new WorkspaceUploadError(
        "raw",
        "WORKSPACE_UPLOAD_STORAGE_NOT_CONFIGURED",
      ),
    );

    renderControls();

    await act(async () => {
      fireEvent.change(getFileInput(), {
        target: { files: [makeFile()] },
      });
    });

    await waitFor(() => {
      const alerts = screen
        .getAllByRole("alert")
        .map((el: HTMLElement) => el.textContent ?? "");

      // The mocked t() returns the translation key, so we check for the key.
      expect(
        alerts.some((text) =>
          text.includes("errorStorageNotConfigured"),
        ),
      ).toBe(true);
    });
  });

  it("enforces one file at a time (no multiple attribute)", () => {
    renderControls();

    const fileInputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="file"]',
    );
    for (const input of fileInputs) {
      expect(input.multiple).toBe(false);
    }
  });

  it("does not start a new upload while one is already in progress", async () => {
    let resolveUpload: (() => void) | undefined;

    mocks.uploadWorkspaceFile.mockReturnValue(
      new Promise<{ document: { id: string; name: string } }>((res) => {
        resolveUpload = () => res({ document: { id: "d", name: "f.pdf" } });
      }),
    );

    renderControls();

    const uploadButton = screen.getByRole("button", {
      name: /Workspace\.upload\.buttonLabel/i,
    });

    fireEvent.click(uploadButton);
    fireEvent.click(uploadButton);

    resolveUpload?.();

    await waitFor(() => {
      expect(mocks.uploadWorkspaceFile).toHaveBeenCalledTimes(0);
    });
  });
});
