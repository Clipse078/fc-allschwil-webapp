export type DeploymentMetadata = {
  environment: "LOCAL" | "STAGE" | "PROD";
  vercelEnv: string | null;
  commitSha: string | null;
  /** Git branch name from VERCEL_GIT_COMMIT_REF. */
  branch: string | null;
  deploymentId: string | null;
  /** The Vercel deployment URL from VERCEL_URL (without protocol, as Vercel provides it). */
  deploymentUrl: string | null;
  /** True when VERCEL_ENV === "preview". Preview deployments are NOT canonical. */
  isPreview: boolean;
  buildTime: string;
};

export function getDeploymentMetadata(): DeploymentMetadata {
  const appEnv = process.env.APP_ENV;
  const vercelEnv = process.env.VERCEL_ENV ?? null;

  let environment: "LOCAL" | "STAGE" | "PROD" = "LOCAL";

  if (appEnv === "stage") {
    environment = "STAGE";
  }

  if (appEnv === "prod") {
    environment = "PROD";
  }

  return {
    environment,
    vercelEnv,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    deploymentUrl: process.env.VERCEL_URL ?? null,
    isPreview: vercelEnv === "preview",
    buildTime: new Date().toISOString(),
  };
}
