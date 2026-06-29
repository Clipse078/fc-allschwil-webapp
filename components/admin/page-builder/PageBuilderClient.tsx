"use client";

/**
 * components/admin/page-builder/PageBuilderClient.tsx
 *
 * Thin wrapper — backwards-compatible entry point for the page builder.
 *
 * All builder logic lives in WebsiteBuilderClient.
 * This component creates a PageSectionAdapter and delegates rendering.
 */

import { useMemo } from "react";
import { createPageAdapter } from "@/lib/website-builder/page-adapter";
import WebsiteBuilderClient from "@/components/admin/website-builder/WebsiteBuilderClient";

type PageBuilderClientProps = {
  pageId: string;
  pageTitle?: string;
  pageSlug?: string;
};

export default function PageBuilderClient({
  pageId,
  pageTitle = "",
  pageSlug = "",
}: PageBuilderClientProps) {
  const adapter = useMemo(
    () => createPageAdapter(pageId, pageTitle, pageSlug),
    [pageId, pageTitle, pageSlug],
  );

  return <WebsiteBuilderClient adapter={adapter} pageId={pageId} />;
}
