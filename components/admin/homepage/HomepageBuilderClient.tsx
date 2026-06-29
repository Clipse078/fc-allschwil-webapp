"use client";

/**
 * components/admin/homepage/HomepageBuilderClient.tsx
 *
 * Client-side wrapper for the homepage builder.
 * Creates the homepage adapter and renders WebsiteBuilderClient.
 *
 * Replaces the legacy HomepageSectionList with the unified CMS V3 builder.
 */

import { useMemo } from "react";
import { createHomepageAdapter } from "@/lib/website-builder/homepage-adapter";
import WebsiteBuilderClient from "@/components/admin/website-builder/WebsiteBuilderClient";

export default function HomepageBuilderClient() {
  const adapter = useMemo(() => createHomepageAdapter(), []);
  return <WebsiteBuilderClient adapter={adapter} />;
}
