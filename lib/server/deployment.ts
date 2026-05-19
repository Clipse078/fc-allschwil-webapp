export type DeploymentMetadata = {
  environment: "LOCAL" | "STAGE" | "PROD";
  vercelEnv: string | null;
  branch: string | null;
  commitSha: string | null;
  deploymentId: string | null;
  deploymentUrl: string | null;
  isPreview: boolean;
  buildTime: string;
};

export function getDeploymentMetadata(): DeploymentMetadata {
  const appEnv = process.env.APP_ENV;
  const vercelEnv = process.env.VERCEL_ENV ?? null;
  const branch = process.env.VERCEL_GIT_COMMIT_REF ?? null;

  let environment: "LOCAL" | "STAGE" | "PROD" = "LOCAL";

  if (appEnv === "stage") {
    environment = "STAGE";
  }

  if (appEnv === "prod") {
    environment = "PROD";
  }

  const isPreview = vercelEnv === "preview";

  return {
    environment,
    vercelEnv,
    branch,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    deploymentUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    isPreview,
    buildTime: new Date().toISOString(),
  };
}
