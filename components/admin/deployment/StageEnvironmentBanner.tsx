import { getPublicEnvironmentLabel, getRuntimeEnvironment } from "@/lib/env";

export default function StageEnvironmentBanner() {
  const env = getRuntimeEnvironment();

  if (!env.isStage) {
    return null;
  }

  return (
    <div className="border-b border-[var(--sce-warning-border)] bg-[var(--sce-warning-light)] px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sce-warning)]">
      {getPublicEnvironmentLabel(env.appEnv)} Environment · Internal review only
    </div>
  );
}
