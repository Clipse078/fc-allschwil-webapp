import { getRuntimeEnvironment } from "@/lib/env";

export default function StageEnvironmentBanner() {
  const env = getRuntimeEnvironment();

  if (!env.isStage) {
    return null;
  }

  return (
    <div className="border-b border-white/20 bg-gradient-to-r from-orange-500 via-red-500 to-blue-600 px-4 py-2 text-center text-xs font-black uppercase tracking-[0.18em] text-white shadow-sm">
      STAGE · Testumgebung – nicht für Live-Nutzung
    </div>
  );
}
