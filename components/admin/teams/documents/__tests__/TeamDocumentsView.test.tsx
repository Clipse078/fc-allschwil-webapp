/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TeamDocumentsView from "../TeamDocumentsView";
import type { TeamDocumentListItem } from "@/lib/teams/team-document-list";

const { refreshMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

function createDocument(
  overrides: Partial<TeamDocumentListItem> = {},
): TeamDocumentListItem {
  return {
    id: "doc-1",
    title: "Saisonplan 2026/27",
    originalFilename: "saisonplan.pdf",
    fileTypeLabel: "PDF",
    fileTypeCategory: "pdf",
    sizeLabel: "824 KB",
    uploadedAtLabel: "28.08.2026",
    uploadedByLabel: "Max Muster",
    showOriginalFilename: true,
    ...overrides,
  };
}

describe("TEAM-COCKPIT-PREMIUM-01J-C — TeamDocumentsView", () => {
  beforeEach(() => {
    refreshMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign: vi.fn() },
    });
  });

  it("renders page heading and workspace layout", () => {
    render(
      <TeamDocumentsView
        teamId="team-a"
        documents={[]}
        canManageDocuments={false}
      />,
    );

    expect(screen.getByText("Team Workspace")).toBeInTheDocument();
    expect(screen.getByTestId("team-documents-page-heading")).toHaveTextContent(
      "Dokumente",
    );
    expect(screen.getByTestId("team-documents-workspace-grid")).toBeInTheDocument();
    expect(screen.getByTestId("team-documents-details-panel")).toBeInTheDocument();
    expect(screen.getByTestId("team-documents-no-selection")).toHaveTextContent(
      "Kein Dokument ausgewählt.",
    );
  });

  it("renders document metadata in desktop table", () => {
    render(
      <TeamDocumentsView
        teamId="team-a"
        documents={[
          createDocument({
            showOriginalFilename: false,
            title: "saisonplan.pdf",
          }),
        ]}
        canManageDocuments={false}
      />,
    );

    expect(screen.getByTestId("team-document-type-doc-1")).toHaveTextContent("PDF");
    expect(screen.getByTestId("team-document-size-doc-1")).toHaveTextContent("824 KB");
    expect(screen.getByTestId("team-document-date-doc-1")).toHaveTextContent(
      "28.08.2026",
    );
    expect(screen.getByTestId("team-document-uploader-doc-1")).toHaveTextContent(
      "Max Muster",
    );
  });

  it("does not expose storage keys or blob URLs", () => {
    const { container } = render(
      <TeamDocumentsView
        teamId="team-a"
        documents={[createDocument({ title: "Interner Bericht" })]}
        canManageDocuments={false}
      />,
    );

    expect(container.innerHTML).not.toContain("storageKey");
    expect(container.innerHTML).not.toMatch(/blob:/i);
    expect(container.innerHTML).not.toMatch(/vercel-storage/i);
  });

  it("shows upload controls for managers", () => {
    render(
      <TeamDocumentsView
        teamId="team-a"
        documents={[createDocument()]}
        canManageDocuments={true}
      />,
    );

    expect(screen.getByTestId("team-documents-upload-button")).toHaveTextContent(
      "Datei hochladen",
    );
  });

  it("hides mutation controls for view-only users", () => {
    render(
      <TeamDocumentsView
        teamId="team-a"
        documents={[createDocument()]}
        canManageDocuments={false}
      />,
    );

    fireEvent.click(screen.getByTestId("team-document-row-doc-1"));

    const desktopPanel = within(screen.getByTestId("team-documents-details-panel"));
    expect(desktopPanel.getByTestId("team-document-download-button")).toBeInTheDocument();
    expect(desktopPanel.queryByTestId("team-document-rename-button")).not.toBeInTheDocument();
    expect(desktopPanel.queryByTestId("team-document-delete-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("team-documents-upload-button")).not.toBeInTheDocument();
  });

  it("selects a document and shows details panel actions", () => {
    render(
      <TeamDocumentsView
        teamId="team-a"
        documents={[createDocument()]}
        canManageDocuments={true}
      />,
    );

    fireEvent.click(screen.getByTestId("team-document-row-doc-1"));

    const desktopPanel = within(screen.getByTestId("team-documents-details-panel"));
    expect(desktopPanel.getByTestId("team-document-details-title")).toHaveTextContent(
      "Saisonplan 2026/27",
    );
    expect(desktopPanel.getByTestId("team-document-download-button")).toBeInTheDocument();
    expect(desktopPanel.getByTestId("team-document-rename-button")).toBeInTheDocument();
    expect(desktopPanel.getByTestId("team-document-delete-button")).toBeInTheDocument();
  });

  it("supports keyboard selection on desktop rows", () => {
    render(
      <TeamDocumentsView
        teamId="team-a"
        documents={[createDocument()]}
        canManageDocuments={false}
      />,
    );

    const row = screen.getByTestId("team-document-row-doc-1");
    fireEvent.keyDown(row, { key: "Enter" });

    expect(
      within(screen.getByTestId("team-documents-details-panel")).getByTestId(
        "team-document-details-title",
      ),
    ).toHaveTextContent("Saisonplan 2026/27");
  });

  it("uploads a file and refreshes the list", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        document: { id: "doc-new", title: "neu.pdf" },
      }),
    } as Response);

    render(
      <TeamDocumentsView
        teamId="team-a"
        documents={[createDocument()]}
        canManageDocuments={true}
      />,
    );

    const file = new File(["%PDF-1.7"], "neu.pdf", { type: "application/pdf" });
    const input = screen.getByTestId("team-documents-file-input");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/teams/team-a/documents",
        expect.objectContaining({ method: "POST" }),
      );
    });

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalled();
      expect(screen.getByTestId("team-documents-upload-success")).toBeInTheDocument();
    });
  });

  it("shows upload validation errors", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: "Dieser Dateityp ist nicht erlaubt.",
        code: "INVALID_INPUT",
      }),
    } as Response);

    render(
      <TeamDocumentsView
        teamId="team-a"
        documents={[createDocument()]}
        canManageDocuments={true}
      />,
    );

    const file = new File(["bad"], "bad.exe", { type: "application/octet-stream" });
    fireEvent.change(screen.getByTestId("team-documents-file-input"), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByTestId("team-documents-upload-error")).toHaveTextContent(
        "Dieser Dateityp ist nicht erlaubt.",
      );
    });
  });

  it("triggers authenticated download path", () => {
    render(
      <TeamDocumentsView
        teamId="team-a"
        documents={[createDocument()]}
        canManageDocuments={false}
      />,
    );

    fireEvent.click(screen.getByTestId("team-document-row-doc-1"));
    fireEvent.click(
      within(screen.getByTestId("team-documents-details-panel")).getByTestId(
        "team-document-download-button",
      ),
    );

    expect(window.location.assign).toHaveBeenCalledWith(
      "/api/teams/team-a/documents/doc-1/download",
    );
  });

  it("renames title only via API", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        document: { id: "doc-1", title: "Neuer Titel" },
      }),
    } as Response);

    render(
      <TeamDocumentsView
        teamId="team-a"
        documents={[createDocument()]}
        canManageDocuments={true}
      />,
    );

    fireEvent.click(screen.getByTestId("team-document-row-doc-1"));
    fireEvent.click(
      within(screen.getByTestId("team-documents-details-panel")).getByTestId(
        "team-document-rename-button",
      ),
    );

    const input = screen.getByTestId("team-document-rename-input");
    fireEvent.change(input, { target: { value: "Neuer Titel" } });
    fireEvent.click(screen.getByTestId("team-document-rename-confirm"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/teams/team-a/documents/doc-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ title: "Neuer Titel" }),
        }),
      );
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it("deletes with confirmation and clears selection", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "Dokument gelöscht." }),
    } as Response);

    render(
      <TeamDocumentsView
        teamId="team-a"
        documents={[createDocument()]}
        canManageDocuments={true}
      />,
    );

    fireEvent.click(screen.getByTestId("team-document-row-doc-1"));
    fireEvent.click(
      within(screen.getByTestId("team-documents-details-panel")).getByTestId(
        "team-document-delete-button",
      ),
    );
    fireEvent.click(screen.getByTestId("team-document-delete-confirm"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/teams/team-a/documents/doc-1",
        expect.objectContaining({ method: "DELETE" }),
      );
      expect(refreshMock).toHaveBeenCalled();
      expect(screen.getByTestId("team-documents-no-selection")).toBeInTheDocument();
    });
  });

  it("renders mobile list and mobile details when selected", () => {
    render(
      <TeamDocumentsView
        teamId="team-a"
        documents={[createDocument()]}
        canManageDocuments={true}
      />,
    );

    fireEvent.click(screen.getByTestId("team-document-mobile-select-doc-1"));

    expect(screen.getByTestId("team-documents-mobile-details")).toBeInTheDocument();
    const mobileDetails = screen.getByTestId("team-documents-mobile-details");
    expect(within(mobileDetails).getByTestId("team-document-download-button")).toBeInTheDocument();
  });

  it("shows manager upload CTA in empty state", () => {
    render(
      <TeamDocumentsView
        teamId="team-a"
        documents={[]}
        canManageDocuments={true}
      />,
    );

    expect(screen.getByTestId("team-documents-empty-upload-button")).toHaveTextContent(
      "Datei hochladen",
    );
  });
});
