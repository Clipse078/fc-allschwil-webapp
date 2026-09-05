import { isAcceptanceEnvironment } from "../env";

export type SecurityHeader = {
  key: string;
  value: string;
};

export type SecurityHeaderRule = {
  source: string;
  headers: SecurityHeader[];
};

type SecurityHeaderEnvironment = {
  NODE_ENV?: string;
  APP_ENV?: string;
  VERCEL?: string;
  VERCEL_ENV?: string;
  VERCEL_TARGET_ENV?: string;
};

const ONE_YEAR_IN_SECONDS = 31_536_000;
export const CSP_REPORT_ENDPOINT = "/api/security/csp-report";
export const ACCEPTANCE_ROBOTS_POLICY = "noindex, nofollow, noarchive";

function isProductionNodeEnvironment(
  environment: SecurityHeaderEnvironment,
): boolean {
  return environment.NODE_ENV === "production";
}

export function isDeployedHttpsEnvironment(
  environment: SecurityHeaderEnvironment,
): boolean {
  if (!isProductionNodeEnvironment(environment)) {
    return false;
  }

  const appEnvironment = environment.APP_ENV?.trim().toLowerCase();
  return (
    Boolean(environment.VERCEL?.trim()) ||
    appEnvironment === "stage" ||
    appEnvironment === "prod" ||
    appEnvironment === "production"
  );
}

export function buildContentSecurityPolicy(
  environment: SecurityHeaderEnvironment,
): string {
  const isDevelopment = !isProductionNodeEnvironment(environment);
  const isDeployedHttps = isDeployedHttpsEnvironment(environment);

  // Next.js emits inline bootstrap/hydration scripts unless every page is
  // forced into nonce-based dynamic rendering. The UI also relies heavily on
  // React style props (notably the Infoboard renderer). Keeping unsafe-inline
  // narrowly scoped to script/style preserves static optimization and those
  // intentional styles; script attributes remain forbidden separately.
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https:${isDevelopment ? " http:" : ""}`,
    "font-src 'self'",
    `connect-src 'self'${isDevelopment ? " ws: wss:" : ""}`,
    "frame-src 'self'",
    "manifest-src 'self'",
    `report-uri ${CSP_REPORT_ENDPOINT}`,
  ];

  if (isDeployedHttps) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

export function buildSecurityHeaderRules(
  environment: SecurityHeaderEnvironment,
): SecurityHeaderRule[] {
  const headers: SecurityHeader[] = [
    {
      key: "Content-Security-Policy-Report-Only",
      value: buildContentSecurityPolicy(environment),
    },
    {
      key: "X-Frame-Options",
      value: "SAMEORIGIN",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), browsing-topics=()",
    },
    {
      key: "Cross-Origin-Opener-Policy",
      value: "same-origin-allow-popups",
    },
    {
      key: "Cross-Origin-Resource-Policy",
      value: "same-origin",
    },
  ];

  if (isDeployedHttpsEnvironment(environment)) {
    headers.push({
      key: "Strict-Transport-Security",
      value: `max-age=${ONE_YEAR_IN_SECONDS}`,
    });
  }

  if (isAcceptanceEnvironment(environment)) {
    headers.push({
      key: "X-Robots-Tag",
      value: ACCEPTANCE_ROBOTS_POLICY,
    });
  }

  return [
    {
      source: "/:path*",
      headers,
    },
    {
      // Public APIs are documented integration surfaces for tenant websites
      // and other cross-origin consumers. The later matching rule overrides
      // only CORP while preserving every other global security header.
      source: "/api/public/:path*",
      headers: [
        {
          key: "Cross-Origin-Resource-Policy",
          value: "cross-origin",
        },
      ],
    },
  ];
}
