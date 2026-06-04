"use client";

import { useState } from "react";
import { Save, Loader2 } from "lucide-react";
import type { WebsiteConfigData } from "@/lib/website/config-queries";

type WebsiteConfigFormProps = {
  initialConfig: WebsiteConfigData | null;
};

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="fca-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="fca-input mt-1 w-full"
      />
      {hint ? <p className="mt-1 text-[0.72rem] text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

export default function WebsiteConfigForm({ initialConfig }: WebsiteConfigFormProps) {
  const cfg = initialConfig;
  const [websiteTitle, setWebsiteTitle] = useState(cfg?.websiteTitle ?? "");
  const [websiteDescription, setWebsiteDescription] = useState(cfg?.websiteDescription ?? "");
  const [heroTagline, setHeroTagline] = useState(cfg?.heroTagline ?? "");
  const [contactEmail, setContactEmail] = useState(cfg?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(cfg?.contactPhone ?? "");
  const [addressStreet, setAddressStreet] = useState(cfg?.addressStreet ?? "");
  const [addressCity, setAddressCity] = useState(cfg?.addressCity ?? "");
  const [addressCountry, setAddressCountry] = useState(cfg?.addressCountry ?? "");
  const [googleMapsUrl, setGoogleMapsUrl] = useState(cfg?.googleMapsUrl ?? "");
  const [facebookUrl, setFacebookUrl] = useState(cfg?.facebookUrl ?? "");
  const [instagramUrl, setInstagramUrl] = useState(cfg?.instagramUrl ?? "");
  const [youtubeUrl, setYoutubeUrl] = useState(cfg?.youtubeUrl ?? "");
  const [twitterUrl, setTwitterUrl] = useState(cfg?.twitterUrl ?? "");
  const [tiktokUrl, setTiktokUrl] = useState(cfg?.tiktokUrl ?? "");

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/website/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteTitle: websiteTitle || null,
          websiteDescription: websiteDescription || null,
          heroTagline: heroTagline || null,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
          addressStreet: addressStreet || null,
          addressCity: addressCity || null,
          addressCountry: addressCountry || null,
          googleMapsUrl: googleMapsUrl || null,
          facebookUrl: facebookUrl || null,
          instagramUrl: instagramUrl || null,
          youtubeUrl: youtubeUrl || null,
          twitterUrl: twitterUrl || null,
          tiktokUrl: tiktokUrl || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Fehler beim Speichern.");
        return;
      }
      setSaved(true);
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {saved ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Einstellungen gespeichert.
        </div>
      ) : null}

      {/* SEO / Identity */}
      <div className="fca-card space-y-5 p-6">
        <h3 className="fca-subheading">Website-Identität &amp; SEO</h3>
        <Field
          id="websiteTitle"
          label="Website-Titel"
          value={websiteTitle}
          onChange={setWebsiteTitle}
          placeholder="FC Allschwil – Offizieller Fussballclub"
          hint="Erscheint im Browser-Tab und in Suchergebnissen."
        />
        <div>
          <label className="fca-label" htmlFor="websiteDescription">
            Meta-Beschreibung
          </label>
          <textarea
            id="websiteDescription"
            rows={2}
            value={websiteDescription}
            onChange={(e) => setWebsiteDescription(e.target.value)}
            placeholder="Offizieller Fussballclub aus Allschwil bei Basel…"
            className="fca-input mt-1 w-full resize-none"
          />
          <p className="mt-1 text-[0.72rem] text-[var(--muted)]">
            Für Google-Vorschau und Social-Sharing. Ca. 155 Zeichen.
          </p>
        </div>
        <Field
          id="heroTagline"
          label="Hero-Tagline"
          value={heroTagline}
          onChange={setHeroTagline}
          placeholder="Leidenschaft. Gemeinschaft. Fussball."
          hint="Grosser Slogan auf der Startseite."
        />
      </div>

      {/* Contact */}
      <div className="fca-card space-y-5 p-6">
        <h3 className="fca-subheading">Kontakt &amp; Adresse</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="contactEmail"
            label="E-Mail"
            type="email"
            value={contactEmail}
            onChange={setContactEmail}
            placeholder="info@fcallschwil.ch"
          />
          <Field
            id="contactPhone"
            label="Telefon"
            type="tel"
            value={contactPhone}
            onChange={setContactPhone}
            placeholder="+41 61 000 00 00"
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="addressStreet"
            label="Strasse"
            value={addressStreet}
            onChange={setAddressStreet}
            placeholder="Musterweg 1"
          />
          <Field
            id="addressCity"
            label="Ort"
            value={addressCity}
            onChange={setAddressCity}
            placeholder="4123 Allschwil"
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="addressCountry"
            label="Land"
            value={addressCountry}
            onChange={setAddressCountry}
            placeholder="Schweiz"
          />
          <Field
            id="googleMapsUrl"
            label="Google Maps URL"
            type="url"
            value={googleMapsUrl}
            onChange={setGoogleMapsUrl}
            placeholder="https://maps.google.com/…"
          />
        </div>
      </div>

      {/* Social media */}
      <div className="fca-card space-y-5 p-6">
        <h3 className="fca-subheading">Social Media</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="facebookUrl"
            label="Facebook"
            type="url"
            value={facebookUrl}
            onChange={setFacebookUrl}
            placeholder="https://www.facebook.com/fcallschwil"
          />
          <Field
            id="instagramUrl"
            label="Instagram"
            type="url"
            value={instagramUrl}
            onChange={setInstagramUrl}
            placeholder="https://www.instagram.com/fcallschwil"
          />
          <Field
            id="youtubeUrl"
            label="YouTube"
            type="url"
            value={youtubeUrl}
            onChange={setYoutubeUrl}
            placeholder="https://www.youtube.com/@fcallschwil"
          />
          <Field
            id="twitterUrl"
            label="X / Twitter"
            type="url"
            value={twitterUrl}
            onChange={setTwitterUrl}
            placeholder="https://twitter.com/fcallschwil"
          />
          <Field
            id="tiktokUrl"
            label="TikTok"
            type="url"
            value={tiktokUrl}
            onChange={setTiktokUrl}
            placeholder="https://www.tiktok.com/@fcallschwil"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className="fca-button-primary flex items-center gap-2"
        >
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {isSaving ? "Speichert…" : "Einstellungen speichern"}
        </button>
      </div>
    </form>
  );
}
