export type DeploymentMetadata = {
  environment: "LOCAL" | "STAGE" | "PROD";
  vercelEnv: string | null;
  isPreview: boolean;
  branchName: string | null;
  commitSha: string | null;
  deploymentId: string | null;
  deploymentUrl: string | null;
  productionUrl: string | null;
  buildTime: string;
};

export function getDeploymentMetadata(): DeploymentMetadata {
  const appEnv = process.env.APP_ENV;

  let environment: "LOCAL" | "STAGE" | "PROD" = "LOCAL";

  if (appEnv === "stage") {
    environment = "STAGE";
  }

  if (appEnv === "prod") {
    environment = "PROD";
  }

  return {
    environment,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    isPreview: process.env.VERCEL_ENV === "preview",
    branchName: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    deploymentUrl: process.env.VERCEL_URL ?? null,
    productionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? null,
    buildTime: new Date().toISOString(),
  };
}
