import { getPublicEnvironmentLabel, getRuntimeEnvironment } from "@/lib/env";

export type DeploymentMetadata = {
  environment: "LOCAL" | "TEST" | "PREVIEW" | "STAGE" | "PROD" | "UNKNOWN";
  vercelEnv: string | null;
  commitSha: string | null;
  deploymentId: string | null;
  buildTime: string;
};

export function getDeploymentMetadata(): DeploymentMetadata {
  const runtime = getRuntimeEnvironment();

  return {
    environment: getPublicEnvironmentLabel(runtime.appEnv),
    vercelEnv: runtime.vercelEnv,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    buildTime: new Date().toISOString(),
  };
}
