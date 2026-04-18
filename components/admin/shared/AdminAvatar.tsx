import Image from "next/image";

type AdminAvatarProps = {
  name: string;
  imageSrc?: string | null;
  size?: "sm" | "md" | "lg";
};

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function AdminAvatar({
  name,
  imageSrc,
  size = "md",
}: AdminAvatarProps) {
  const sizeClass =
    size === "sm"
      ? "h-11 w-11"
      : size === "lg"
        ? "h-16 w-16"
        : "h-14 w-14";

  if (imageSrc) {
    return (
      <div
        className={`relative ${sizeClass} overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm`}
      >
        <Image
          src={imageSrc}
          alt={name}
          fill
          className="object-cover"
          sizes={size === "lg" ? "64px" : size === "sm" ? "44px" : "56px"}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex ${sizeClass} items-center justify-center rounded-full border border-slate-200 bg-gradient-to-br from-white to-slate-100 font-[var(--font-display)] text-sm font-bold uppercase tracking-[0.08em] text-[#0b4aa2] shadow-sm`}
    >
      {getInitials(name) || "FA"}
    </div>
  );
}
