"use client";

/**
 * PERSON-UX-09 — Person header photo management widget.
 *
 * Renders the Person avatar in the workspace header. When the caller holds
 * people.manage, a subtle camera-icon affordance is overlaid. Clicking the
 * avatar or the affordance opens a small action menu:
 *
 *   • Foto hochladen    — when no photo exists
 *   • Foto ändern       — when a photo exists
 *   • Foto entfernen    — when a photo exists
 *
 * Uses POST/DELETE /api/people/[id]/profile-image.
 * After each mutation, calls router.refresh() so the server-rendered header
 * reflects the new state without a full page reload.
 *
 * Unauthorized users: component renders AdminAvatar read-only (no affordance).
 */

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Upload, Trash2, X } from "lucide-react";

type Props = {
  personId: string;
  personName: string;
  initialImageUrl: string | null | undefined;
  canManage: boolean;
};

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function PersonHeaderPhotoAdmin({
  personId,
  personName,
  initialImageUrl,
  canManage,
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl ?? null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [menuOpen]);

  const handleAvatarClick = useCallback(() => {
    if (!canManage) return;
    setError(null);
    setMenuOpen((prev) => !prev);
  }, [canManage]);

  const handleUploadClick = useCallback(() => {
    setMenuOpen(false);
    fileRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset input so same file can be re-selected
      e.target.value = "";

      setError(null);
      setUploading(true);

      try {
        const fd = new FormData();
        fd.append("file", file);

        const res = await fetch(`/api/people/${encodeURIComponent(personId)}/profile-image`, {
          method: "POST",
          body: fd,
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          setError(data?.error ?? "Bild konnte nicht hochgeladen werden.");
          return;
        }

        setImageUrl(data?.imageUrl ?? null);
        router.refresh();
      } catch {
        setError("Netzwerkfehler. Bitte erneut versuchen.");
      } finally {
        setUploading(false);
      }
    },
    [personId, router],
  );

  const handleRemove = useCallback(async () => {
    setMenuOpen(false);
    setError(null);
    setRemoving(true);

    try {
      const res = await fetch(`/api/people/${encodeURIComponent(personId)}/profile-image`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Profilbild konnte nicht entfernt werden.");
        return;
      }

      setImageUrl(null);
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setRemoving(false);
    }
  }, [personId, router]);

  const initials = getInitials(personName) || "FA";
  const busy = uploading || removing;

  return (
    <div className="relative shrink-0" ref={menuRef}>
      {/* Hidden file input */}
      {canManage && (
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          aria-hidden="true"
          onChange={handleFileChange}
        />
      )}

      {/* Avatar circle — clickable for managers */}
      <button
        type="button"
        onClick={handleAvatarClick}
        disabled={!canManage || busy}
        aria-label={canManage ? "Profilbild verwalten" : personName}
        className={[
          "relative h-14 w-14 overflow-hidden rounded-full",
          "border border-slate-200 bg-white shadow-sm",
          canManage
            ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-2"
            : "cursor-default",
          busy ? "opacity-60" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={personName}
            fill
            className="object-cover"
            sizes="56px"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white to-slate-100 font-[var(--font-display)] text-sm font-bold uppercase tracking-[0.08em] text-[#0b4aa2]"
            aria-hidden="true"
          >
            {uploading ? (
              <Upload className="h-4 w-4 animate-pulse text-[var(--sce-primary)]" />
            ) : (
              initials
            )}
          </div>
        )}

        {/* Edit affordance overlay — only visible for managers, not during upload */}
        {canManage && !busy && (
          <div
            className="absolute inset-0 flex items-end justify-center bg-black/0 transition-all duration-150 hover:bg-black/30 rounded-full"
            aria-hidden="true"
          >
            <Camera className="mb-1 h-3.5 w-3.5 text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:opacity-100" />
          </div>
        )}

        {/* Spinner overlay during remove */}
        {removing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full">
            <Trash2 className="h-4 w-4 animate-pulse text-white" />
          </div>
        )}
      </button>

      {/* Camera badge — always visible on avatar corner for managers */}
      {canManage && !busy && (
        <div
          className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-[var(--sce-primary)] shadow-sm"
          aria-hidden="true"
        >
          <Camera className="h-3 w-3 text-white" />
        </div>
      )}

      {/* Action menu */}
      {menuOpen && (
        <div
          className="absolute left-0 top-[calc(100%+8px)] z-30 min-w-[176px] rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-[var(--shadow-lg)]"
          role="menu"
          aria-label="Profilbild-Aktionen"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleUploadClick}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-2)] transition"
          >
            <Upload className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
            {imageUrl ? "Foto ändern" : "Foto hochladen"}
          </button>

          {imageUrl && (
            <button
              type="button"
              role="menuitem"
              onClick={handleRemove}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition"
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" />
              Foto entfernen
            </button>
          )}

          <div className="border-t border-[var(--border)] mt-1 pt-1 px-3 py-1.5">
            <p className="text-[10px] text-[var(--muted)]">JPEG, PNG oder WebP · max. 4 MB</p>
          </div>
        </div>
      )}

      {/* Error feedback below avatar */}
      {error && (
        <div className="absolute left-0 top-[calc(100%+60px)] z-30 min-w-[220px] rounded-lg border border-red-200 bg-red-50 px-3 py-2 shadow-sm">
          <div className="flex items-start gap-2">
            <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
