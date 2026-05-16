import type { WebsiteTheme } from "@/lib/website/theme-engine";

type Props = {
  props: { imageSrc?: string; imageAlt?: string; caption?: string };
  theme: WebsiteTheme;
};

export default function ImageBannerBlock({ props, theme }: Props) {
  if (!props.imageSrc) return null;
  return (
    <section className="relative overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={props.imageSrc}
        alt={props.imageAlt ?? ""}
        className="h-[340px] w-full object-cover lg:h-[440px]"
      />
      {props.caption && (
        <p className="px-6 py-2 text-center text-xs" style={{ color: theme.textMuted }}>
          {props.caption}
        </p>
      )}
    </section>
  );
}
