/**
 * lib/website-builder/homepage-adapter.ts
 *
 * SectionAdapter implementation for HomepageSection.
 *
 * Wraps /api/homepage-sections/... endpoints.
 * Disabled capabilities: create, delete, duplicate, drag-reorder, revisions.
 * Bootstrap: available when sections array is empty.
 *
 * Workflow mapping: homepage uses per-action endpoints
 * (/publish, /unpublish, /approve, /reject, /request-review, /schedule)
 * which this adapter maps to the generic workflow(action) interface.
 */

import type { ContentRevisionItem } from "@/lib/cms/revision-engine";
import {
  getPublicBlockMeta,
  projectBlockPublicConfig,
} from "@/lib/homepage/block-registry";
import type {
  SectionAdapter,
  SectionItem,
  PreviewSectionItem,
  SectionCapabilities,
} from "./adapter";

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

const HOMEPAGE_CAPABILITIES: SectionCapabilities = {
  canCreate: false,
  canDelete: false,
  canDuplicate: false,
  canDragReorder: false,
  hasRevisions: false,
};

// ---------------------------------------------------------------------------
// Workflow endpoint map
// ---------------------------------------------------------------------------

// Homepage uses separate per-action endpoints instead of a single workflow endpoint
const WORKFLOW_ENDPOINTS: Record<string, string> = {
  publish: "publish",
  unpublish: "unpublish",
  "request-review": "request-review",
  approve: "approve",
  reject: "reject",
  schedule: "schedule",
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

export function createHomepageAdapter(): SectionAdapter {
  const base = "/api/homepage-sections";

  return {
    capabilities: HOMEPAGE_CAPABILITIES,
    contextTitle: "Homepage",
    contextSlug: "/",

    async load() {
      const d = await apiCall<{ sections: SectionItem[] }>(base);
      return d.sections ?? [];
    },

    async create() {
      throw new Error(
        "Homepage-Sektionen werden über den Bootstrap-Prozess erstellt.",
      );
    },

    async saveConfig(id, label, config) {
      const d = await apiCall<{ section: SectionItem }>(`${base}/${id}/config`, {
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

    async delete() {
      throw new Error("Homepage-Sektionen können nicht gelöscht werden.");
    },

    async duplicate() {
      throw new Error("Homepage-Sektionen können nicht dupliziert werden.");
    },

    async reorder() {
      throw new Error(
        "Drag-and-Drop Neuordnung ist für die Homepage nicht verfügbar.",
      );
    },

    async workflow(id, action, extra) {
      const endpoint = WORKFLOW_ENDPOINTS[action];
      if (!endpoint) throw new Error(`Unbekannte Workflow-Aktion: ${action}`);
      const d = await apiCall<{ section: SectionItem }>(
        `${base}/${id}/${endpoint}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(extra ?? {}),
        },
      );
      return d.section;
    },

    async getRevisions() {
      return [] as ContentRevisionItem[];
    },

    async restoreRevision() {
      throw new Error(
        "Versionswiederherstellung für Homepage-Sektionen nicht verfügbar.",
      );
    },

    async loadPreview() {
      const d = await apiCall<{
        sections: Array<{
          id: string;
          type: string;
          label: string;
          sortOrder: number;
          config: unknown;
          isEnabled: boolean;
          publishStatus: string;
          approvalStatus: string;
          isDraft?: boolean;
          isDisabled?: boolean;
        }>;
      }>(`${base}/preview`);

      return (d.sections ?? []).map((s) => ({
        id: s.id,
        type: s.type,
        label: s.label,
        sortOrder: s.sortOrder,
        isEnabled: s.isEnabled ?? !s.isDisabled,
        publishStatus: s.publishStatus ?? (s.isDraft ? "DRAFT" : "PUBLISHED"),
        approvalStatus: s.approvalStatus ?? "NOT_REQUIRED",
        config: projectBlockPublicConfig(
          s.type,
          (s.config as Record<string, unknown>) ?? {},
        ),
        block: getPublicBlockMeta(s.type),
      })) as PreviewSectionItem[];
    },

    async bootstrap() {
      const d = await apiCall<{ sections: SectionItem[] }>(base, {
        method: "POST",
      });
      return d.sections ?? [];
    },
  };
}
