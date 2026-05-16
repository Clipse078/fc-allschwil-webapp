import type { WebsiteTheme } from "@/lib/website/theme-engine";

type Props = {
  props: { address?: string; phone?: string; email?: string; mapEmbedUrl?: string; heading?: string };
  theme: WebsiteTheme;
};

export default function ContactBlock({ props, theme }: Props) {
  const { address, phone, email, mapEmbedUrl, heading } = props;
  return (
    <section className="px-6 py-14 lg:px-12">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-2xl font-bold" style={{ color: theme.text }}>
          {heading ?? "Kontakt"}
        </h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="space-y-3 text-sm" style={{ color: theme.textMuted }}>
            {address && <p>📍 {address}</p>}
            {phone && <p>📞 {phone}</p>}
            {email && (
              <p>
                ✉{" "}
                <a href={`mailto:${email}`} style={{ color: theme.primary }}>
                  {email}
                </a>
              </p>
            )}
          </div>
          {mapEmbedUrl && (
            <iframe
              src={mapEmbedUrl}
              className="h-48 w-full rounded-[14px]"
              loading="lazy"
              title="Karte"
            />
          )}
        </div>
      </div>
    </section>
  );
}
