"use client";

import { useState } from "react";
import {
  FolderOpen,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import type { MediaFolderTree } from "@/lib/media/types";

type MediaFolderSidebarProps = {
  tree: MediaFolderTree[];
  activeFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onFoldersChange: () => void;
};

export default function MediaFolderSidebar({
  tree,
  activeFolderId,
  onSelectFolder,
  onFoldersChange,
}: MediaFolderSidebarProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/media/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Fehler beim Erstellen.");
      } else {
        setNewName("");
        setCreating(false);
        onFoldersChange();
      }
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {/* All media */}
      <button
        type="button"
        onClick={() => onSelectFolder(null)}
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
          activeFolderId === null
            ? "bg-[var(--tenant-primary)] text-white font-medium"
            : "text-[var(--foreground)] hover:bg-[var(--surface-2)]"
        }`}
      >
        <FolderOpen className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">Alle Medien</span>
      </button>

      {/* Folder tree */}
      {tree.map((node) => (
        <FolderTreeNode
          key={node.id}
          node={node}
          activeFolderId={activeFolderId}
          onSelectFolder={onSelectFolder}
          onFoldersChange={onFoldersChange}
          depth={0}
        />
      ))}

      {/* Create folder */}
      {creating ? (
        <form onSubmit={handleCreate} className="mt-1 space-y-1.5 px-1">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ordner-Name"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--tenant-primary)]"
          />
          {error && <p className="text-[10px] text-rose-600">{error}</p>}
          <div className="flex gap-1.5">
            <button
              type="submit"
              disabled={saving || !newName.trim()}
              className="flex-1 rounded-lg bg-[var(--tenant-primary)] py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="mx-auto h-3 w-3 animate-spin" /> : "Erstellen"}
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setNewName(""); setError(null); }}
              className="flex-1 rounded-lg border border-[var(--border)] py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Abbrechen
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          <FolderPlus className="h-3.5 w-3.5" />
          Neuer Ordner
        </button>
      )}
    </div>
  );
}

// ── FolderTreeNode ─────────────────────────────────────────────────────────────

function FolderTreeNode({
  node,
  activeFolderId,
  onSelectFolder,
  onFoldersChange,
  depth,
}: {
  node: MediaFolderTree;
  activeFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onFoldersChange: () => void;
  depth: number;
}) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState(node.name);
  const [saving, setSaving] = useState(false);

  const hasChildren = node.children.length > 0;
  const isActive = activeFolderId === node.id;

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renameName.trim() || renameName.trim() === node.name) {
      setRenaming(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/media/folders/${node.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameName.trim() }),
      });
      if (res.ok) {
        setRenaming(false);
        onFoldersChange();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setMenuOpen(false);
    const res = await fetch(`/api/media/folders/${node.id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      if (activeFolderId === node.id) onSelectFolder(null);
      onFoldersChange();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data?.error ?? "Ordner konnte nicht gelöscht werden.");
    }
  }

  return (
    <div>
      <div
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        className={`group flex items-center gap-1 rounded-lg pr-1 transition ${
          isActive ? "bg-[var(--tenant-primary)] text-white" : "hover:bg-[var(--surface-2)]"
        }`}
      >
        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`flex-shrink-0 rounded p-1 ${isActive ? "hover:bg-white/20" : "hover:bg-[var(--surface-3,var(--surface-2))]"}`}
        >
          {hasChildren ? (
            open ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )
          ) : (
            <span className="inline-block h-3 w-3" />
          )}
        </button>

        {renaming ? (
          <form onSubmit={handleRename} className="flex-1">
            <input
              autoFocus
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onBlur={() => setRenaming(false)}
              className="w-full rounded bg-white/20 px-1 py-0.5 text-xs text-[var(--foreground)] focus:outline-none"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => onSelectFolder(node.id)}
            className="flex flex-1 items-center gap-1.5 overflow-hidden py-1.5 text-sm"
          >
            <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{node.name}</span>
            {node._count && (
              <span className={`ml-auto text-[10px] ${isActive ? "text-white/70" : "text-[var(--muted)]"}`}>
                {node._count.assets}
              </span>
            )}
          </button>
        )}

        {/* Context menu */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            className={`rounded p-1 opacity-0 group-hover:opacity-100 ${
              isActive ? "hover:bg-white/20" : "hover:bg-[var(--surface-2)]"
            }`}
          >
            <MoreHorizontal className="h-3 w-3" />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 z-10 mt-1 w-36 rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg"
              onBlur={() => setMenuOpen(false)}
            >
              <button
                type="button"
                onClick={() => { setMenuOpen(false); setRenaming(true); setRenameName(node.name); }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--surface-2)]"
              >
                <Pencil className="h-3 w-3" /> Umbenennen
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="h-3 w-3" /> Löschen
              </button>
            </div>
          )}
        </div>
      </div>

      {open && hasChildren && (
        <div>
          {node.children.map((child) => (
            <FolderTreeNode
              key={child.id}
              node={child}
              activeFolderId={activeFolderId}
              onSelectFolder={onSelectFolder}
              onFoldersChange={onFoldersChange}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
