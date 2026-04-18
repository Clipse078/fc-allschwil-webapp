import { getPublicEnvironmentLabel, getRuntimeEnvironment } from "@/lib/env";

export default function StageEnvironmentBanner() {
  const env = getRuntimeEnvironment();

  if (!env.isStage) {
    return null;
  }

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
      {getPublicEnvironmentLabel(env.appEnv)} Environment · Internal review only
    </div>
  );
}
