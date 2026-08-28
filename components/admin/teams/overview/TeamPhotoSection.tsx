"use client";

/**
 * TEAM-COCKPIT-PREMIUM-01K — compact team photo management on Übersicht.
 *
 * Restrained visual identity area. Managers see upload/change/remove actions;
 * viewers see the photo or a calm placeholder only.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, ImageIcon, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Props = {
  teamId: string;
  teamDisplayName: string;
  initialPhotoUrl: string | null | undefined;
  canManagePhoto: boolean;
};

export default function TeamPhotoSection({
  teamId,
  teamDisplayName,
  initialPhotoUrl,
  canManagePhoto,
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [photoUrl, setPhotoUrl] = useState<string | null>(initialPhotoUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPhotoUrl(initialPhotoUrl ?? null);
  }, [initialPhotoUrl]);

  const altText = `Teamfoto ${teamDisplayName}`;
  const busy = uploading || removing;

  const handleUploadClick = useCallback(() => {
    if (!canManagePhoto || busy) return;
    setError(null);
    fileRef.current?.click();
  }, [canManagePhoto, busy]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      setError(null);
      setUploading(true);

      try {
        const fd = new FormData();
        fd.append("file", file);

        const res = await fetch(`/api/teams/${encodeURIComponent(teamId)}/photo`, {
          method: "POST",
          body: fd,
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          setError(data?.error ?? "Teamfoto konnte nicht hochgeladen werden.");
          return;
        }

        setPhotoUrl(data?.photoUrl ?? null);
        router.refresh();
      } catch {
        setError("Netzwerkfehler. Bitte erneut versuchen.");
      } finally {
        setUploading(false);
      }
    },
    [teamId, router],
  );

  const handleRemove = useCallback(async () => {
    if (!canManagePhoto || busy) return;
    if (!window.confirm("Teamfoto wirklich entfernen?")) return;

    setError(null);
    setRemoving(true);

    try {
      const res = await fetch(`/api/teams/${encodeURIComponent(teamId)}/photo`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Teamfoto konnte nicht entfernt werden.");
        return;
      }

      setPhotoUrl(null);
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setRemoving(false);
    }
  }, [canManagePhoto, busy, teamId, router]);

  return (
    <section
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
      data-testid="team-photo-section"
      aria-label="Teamfoto"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          className="relative mx-auto h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)] sm:mx-0 sm:h-20 sm:w-20"
          data-testid="team-photo-frame"
        >
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt={altText}
              fill
              className="object-cover"
              sizes="96px"
              data-testid="team-photo-image"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-[var(--muted)]"
              data-testid="team-photo-placeholder"
              aria-hidden={canManagePhoto ? undefined : true}
            >
              <ImageIcon className="h-8 w-8 opacity-50" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">Teamfoto</p>
            <p className="text-xs text-[var(--muted)]">
              Visuelle Identität des Teams — unabhängig von der Saison.
            </p>
          </div>

          {canManagePhoto ? (
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="Teamfoto auswählen"
                onChange={handleFileChange}
                disabled={busy}
              />

              <Button
                variant="secondary"
                size="sm"
                iconLeft={
                  uploading ? (
                    <Upload className="h-3.5 w-3.5 animate-pulse" />
                  ) : (
                    <Camera className="h-3.5 w-3.5" />
                  )
                }
                onClick={handleUploadClick}
                disabled={busy}
                data-testid="team-photo-upload-button"
                aria-busy={uploading}
              >
                {uploading ? "Wird hochgeladen …" : photoUrl ? "Foto ändern" : "Foto hochladen"}
              </Button>

              {photoUrl ? (
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={
                    removing ? (
                      <Trash2 className="h-3.5 w-3.5 animate-pulse" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )
                  }
                  onClick={handleRemove}
                  disabled={busy}
                  data-testid="team-photo-remove-button"
                  aria-busy={removing}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  {removing ? "Wird entfernt …" : "Foto entfernen"}
                </Button>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="text-xs text-red-600" role="alert" data-testid="team-photo-error">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
