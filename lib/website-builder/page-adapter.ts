/**
 * lib/website-builder/page-adapter.ts
 *
 * SectionAdapter implementation for WebsitePageSection (page sections).
 *
 * Wraps /api/website-pages/[id]/sections/... endpoints.
 * All capabilities enabled (create, delete, duplicate, drag-reorder, revisions).
 */

import type { ContentRevisionItem } from "@/lib/cms/revision-engine";
import type {
  SectionAdapter,
  SectionItem,
  PreviewSectionItem,
  SectionCapabilities,
} from "./adapter";

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

const PAGE_CAPABILITIES: SectionCapabilities = {
  canCreate: true,
  canDelete: true,
  canDuplicate: true,
  canDragReorder: true,
  hasRevisions: true,
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) throw new Error((data?.error as string | undefined) ?? "API-Fehler");
  return data as T;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPageAdapter(
  pageId: string,
  pageTitle = "",
  pageSlug = "",
): SectionAdapter {
  const base = `/api/website-pages/${pageId}/sections`;

  return {
    capabilities: PAGE_CAPABILITIES,
    contextTitle: pageTitle,
    contextSlug: pageSlug,

    async load() {
      const d = await apiCall<{ sections: SectionItem[] }>(base);
      return d.sections ?? [];
    },

    async create(type, label, config) {
      const d = await apiCall<{ section: SectionItem }>(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, label, config }),
      });
      return d.section;
    },

    async saveConfig(id, label, config) {
      const d = await apiCall<{ section: SectionItem }>(`${base}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, config }),
      });
      return d.section;
    },

    async toggle(id) {
      const d = await apiCall<{ section: SectionItem }>(`${base}/${id}/toggle`, {
        method: "PATCH",
      });
      return d.section;
    },

    async move(id, direction) {
      const d = await apiCall<{ sections: SectionItem[] }>(`${base}/${id}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      return d.sections ?? [];
    },

    async delete(id) {
      const res = await fetch(`${base}/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const d = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error((d?.error as string | undefined) ?? "Löschen fehlgeschlagen");
      }
    },

    async duplicate(id) {
      const d = await apiCall<{ section: SectionItem }>(`${base}/${id}/duplicate`, {
        method: "POST",
      });
      return d.section;
    },

    async reorder(orderedIds) {
      const d = await apiCall<{ sections: SectionItem[] }>(`${base}/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });
      return d.sections ?? [];
    },

    async workflow(id, action, extra) {
      const d = await apiCall<{ section: SectionItem }>(
        `${base}/${id}/workflow?action=${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(extra ?? {}),
        },
      );
      return d.section;
    },

    async getRevisions(id) {
      const d = await apiCall<{ revisions: ContentRevisionItem[] }>(
        `${base}/${id}/revisions`,
      );
      return d.revisions ?? [];
    },

    async restoreRevision(id, revId) {
      const d = await apiCall<{ section: SectionItem }>(
        `${base}/${id}/revisions/${revId}/restore`,
        { method: "POST" },
      );
      return d.section;
    },

    async loadPreview() {
      const d = await apiCall<{ sections: PreviewSectionItem[] }>(
        `/api/website-pages/${pageId}/preview`,
      );
      return d.sections ?? [];
    },
  };
}
