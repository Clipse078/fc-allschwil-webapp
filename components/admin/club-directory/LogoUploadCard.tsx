"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { ClubLogo } from "./ClubLogo";

type Resource = "club" | "team";

type LogoUploadCardProps = {
  resource: Resource;
  id: string;
  name: string;
  logoUrl: string | null;
};

export function LogoUploadCard({ resource, id, name, logoUrl }: LogoUploadCardProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint =
    resource === "club" ? `/api/club-directory/clubs/${id}/logo` : `/api/club-directory/teams/${id}/logo`;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch(endpoint, { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Upload fehlgeschlagen.");
        return;
      }
      router.refresh();
    } catch {
      setError("Netzwerkfehler beim Upload.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      <ClubLogo logoUrl={logoUrl} name={name} size="lg" />
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-sm font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {logoUrl ? "Logo ersetzen" : "Logo hochladen"}
        </button>
        <p className="text-xs text-[var(--muted)]">PNG, JPEG oder WebP, max. 2 MB.</p>
        {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
