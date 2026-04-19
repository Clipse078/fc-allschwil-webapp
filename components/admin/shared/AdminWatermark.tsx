import Image from "next/image";

type AdminWatermarkProps = {
  className?: string;
};

export default function AdminWatermark({ className = "" }: AdminWatermarkProps) {
  return (
    <div
      className={[
        "pointer-events-none select-none opacity-[0.08]",
        className,
      ].join(" ").trim()}
      aria-hidden="true"
    >
      <Image
        src="/images/logos/fc-allschwil.png"
        alt=""
        width={320}
        height={320}
        className="h-auto w-full object-contain"
        priority={false}
      />
    </div>
  );
}