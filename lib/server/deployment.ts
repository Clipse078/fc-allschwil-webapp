export type DeploymentMetadata = {
  environment: "LOCAL" | "STAGE" | "PROD";
  vercelEnv: string | null;
  isVercelPreview: boolean;
  commitSha: string | null;
  commitShortSha: string | null;
  commitRef: string | null;
  commitMessage: string | null;
  deploymentId: string | null;
  vercelUrl: string | null;
  region: string | null;
  buildTime: string;
};

function readEnv(name: string): string | null {
  const value = process.env[name];

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

export function getDeploymentMetadata(): DeploymentMetadata {
  const appEnv = process.env.APP_ENV;

  let environment: "LOCAL" | "STAGE" | "PROD" = "LOCAL";

  if (appEnv === "stage") {
    environment = "STAGE";
  }

  if (appEnv === "prod") {
    environment = "PROD";
  }

  const vercelEnv = readEnv("VERCEL_ENV");
  const commitSha = readEnv("VERCEL_GIT_COMMIT_SHA");

  return {
    environment,
    vercelEnv,
    isVercelPreview: vercelEnv === "preview",
    commitSha,
    commitShortSha: commitSha ? commitSha.slice(0, 7) : null,
    commitRef: readEnv("VERCEL_GIT_COMMIT_REF"),
    commitMessage: readEnv("VERCEL_GIT_COMMIT_MESSAGE"),
    deploymentId: readEnv("VERCEL_DEPLOYMENT_ID"),
    vercelUrl: readEnv("VERCEL_URL"),
    region: readEnv("VERCEL_REGION"),
    buildTime: new Date().toISOString(),
  };
}
