import type { AcceptancePasswords } from "@/lib/acceptance/bootstrap";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type SmokeScenarioResult = {
  id: string;
  name: string;
  category: SmokeScenarioCategory;
  passed: boolean;
  detail: string;
};

export type SmokeScenarioCategory =
  | "session-auth"
  | "tenant-isolation"
  | "role-isolation"
  | "super-admin";

export type SmokeRunSummary = {
  baseUrl: string;
  passed: number;
  failed: number;
  total: number;
  results: SmokeScenarioResult[];
  platformNotes: string[];
};

export type AcceptanceSecuritySmokeConfig = {
  baseUrl: string;
  passwords: AcceptancePasswords;
};

export type SmokeHttpResponse = {
  status: number;
  headers: Headers;
  bodyText: string;
  json: () => unknown;
};

export type SmokeHttpClient = {
  get: (path: string) => Promise<SmokeHttpResponse>;
  post: (path: string, body?: unknown) => Promise<SmokeHttpResponse>;
  clearCookies: () => void;
  loginWithCredentials: (email: string, password: string) => Promise<void>;
  getSession: () => Promise<Record<string, unknown> | null>;
};

export type SmokeFixtureClientKey =
  | "anonymous"
  | "superadmin"
  | "alphaAdmin"
  | "alphaMember"
  | "betaAdmin"
  | "betaMember";

export type SmokeFixtureClients = Record<SmokeFixtureClientKey, SmokeHttpClient>;

export type SmokeScenarioContext = {
  clients: SmokeFixtureClients;
  config: AcceptanceSecuritySmokeConfig;
};

export type SmokeScenario = {
  id: string;
  name: string;
  category: SmokeScenarioCategory;
  run: (context: SmokeScenarioContext) => Promise<string>;
};
