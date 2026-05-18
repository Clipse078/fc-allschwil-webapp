import Image from "next/image";
import {
  ACTIVE_TENANT_LOGO_SRC,
  ACTIVE_TENANT_NAME,
} from "@/lib/platform/constants";

export default function AdminWatermark() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-1/2 top-1/2 -translate-x-[42%] -translate-y-1/2 rotate-[10deg]">
        <div className="relative h-[520px] w-[520px] max-w-[62vw] opacity-[0.03]">
          <Image
            src={ACTIVE_TENANT_LOGO_SRC}
            alt={`${ACTIVE_TENANT_NAME} watermark`}
            fill
            className="object-contain"
            sizes="520px"
          />
        </div>
      </div>
    </div>
  );
}
