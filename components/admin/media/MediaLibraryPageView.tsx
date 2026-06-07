"use client";

import { useState, useCallback } from "react";
import type { MediaAssetListItem } from "@/lib/media/types";
import MediaLibraryGrid from "@/components/admin/media/MediaLibraryGrid";
import MediaUploadButton from "@/components/admin/media/MediaUploadButton";
import {
  PageShell,
  PageBreadcrumbs,
  PageHeader,
  PageActions,
} from "@/components/ui/page";

/**
 * Client boundary for the Media Library admin page.
 * Holds the refreshKey that coordinates uploads from the page-level
 * PageActions button with the grid's data fetch cycle.
 */
export default function MediaLibraryPageView() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploaded = useCallback((_asset: MediaAssetListItem) => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <PageShell fullWidth>
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Website" },
          { label: "Mediathek" },
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <PageHeader
          eyebrow="Website"
          title="Mediathek"
          description="Bilder und Medien verwalten, organisieren und wiederverwenden."
          className="mb-0"
        />
        <PageActions>
          <MediaUploadButton
            onUploaded={handleUploaded}
            label="Medien hochladen"
            className="fca-button-primary"
          />
        </PageActions>
      </div>
      <MediaLibraryGrid refreshKey={refreshKey} />
    </PageShell>
  );
}
