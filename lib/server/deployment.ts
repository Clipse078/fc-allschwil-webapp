export type DeploymentMetadata = {
  environment: "LOCAL" | "STAGE" | "PROD";
  vercelEnv: string | null;
  commitSha: string | null;
  branch: string | null;
  deploymentId: string | null;
  projectName: string | null;
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
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    projectName: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? null,
    buildTime: new Date().toISOString(),
  };
}
