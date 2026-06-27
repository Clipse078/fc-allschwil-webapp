/**
 * Client-safe media utility functions.
 *
 * This file contains pure functions with no server-side dependencies.
 * Safe to import from both client and server components.
 */

import type { MediaFolderItem, MediaFolderTree } from "@/lib/media/types";

/**
 * Converts a flat list of MediaFolderItems into a nested tree structure.
 */
export function buildFolderTree(folders: MediaFolderItem[]): MediaFolderTree[] {
  const map = new Map<string, MediaFolderTree>();
  for (const f of folders) {
    map.set(f.id, { ...f, children: [] });
  }
  const roots: MediaFolderTree[] = [];
  for (const f of folders) {
    const node = map.get(f.id)!;
    if (f.parentId && map.has(f.parentId)) {
      map.get(f.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/**
 * Format file size in human-readable format.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
