"use client";

import Image from "next/image";
import { ChangeEvent, DragEvent, useState, useTransition } from "react";
import { Camera, CheckCircle2, UploadCloud } from "lucide-react";

type Props = {
  personId: string;
  name: string;
  initialPhotoUrl?: string | null;
  canEdit: boolean;
};

export default function PersonPhotoUploader({
  personId,
  name,
  initialPhotoUrl,
  canEdit,
}: Props) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialPhotoUrl ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialPhotoUrl ?? null);
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSelectedFile(file: File | null) {
    if (!file || !canEdit) return;

    setError(null);
    setMessage(null);

    if (!file.type.startsWith("image/")) {
      setError("Bitte ein Bild auswählen.");
      return;
    }

    setPreviewUrl(URL.createObjectURL(file));

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`/api/people/${personId}/photo`, {
          method: "POST",
          body: formData,
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error ?? "Profilfoto konnte nicht gespeichert werden.");
        }

        const nextUrl = data?.person?.photoUrl ?? null;
        setPhotoUrl(nextUrl);
        setPreviewUrl(nextUrl);
        setMessage(data?.message ?? "Profilfoto gespeichert.");
      } catch (uploadError) {
        setPreviewUrl(photoUrl);
        setError(uploadError instanceof Error ? uploadError.message : "Profilfoto konnte nicht gespeichert werden.");
      }
    });
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    handleSelectedFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    handleSelectedFile(event.dataTransfer.files?.[0] ?? null);
  }

  return (
    <div className="rounded-[26px] border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[30px] border border-slate-200 bg-gradient-to-br from-blue-50 to-red-50 shadow-sm">
          {previewUrl ? (
            <Image src={previewUrl} alt={name} fill className="object-cover" sizes="112px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl font-black text-[#0b4aa2]">
              {name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "FA"}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="fca-eyebrow">Profilfoto</p>
          <h3 className="mt-2 text-lg font-black text-slate-950">Foto der Person</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            Wird zentral im Personenprofil gespeichert und später in Teamlisten, People Picker und Organigramm verwendet.
          </p>

          {canEdit ? (
            <label
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={
                "mt-4 flex cursor-pointer items-center justify-center gap-3 rounded-[24px] border border-dashed px-5 py-4 text-sm font-black transition " +
                (isDragging ? "border-blue-300 bg-blue-50 text-[#0b4aa2]" : "border-slate-300 bg-slate-50 text-slate-600 hover:bg-white")
              }
            >
              <UploadCloud className="h-5 w-5" />
              Foto hier ablegen oder auswählen
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleInputChange} className="sr-only" />
            </label>
          ) : (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
              Profilfoto ist nur lesbar.
            </div>
          )}

          {isPending ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-black text-[#0b4aa2]">
              <Camera className="h-3.5 w-3.5" />
              Speichern...
            </div>
          ) : null}

          {message ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

