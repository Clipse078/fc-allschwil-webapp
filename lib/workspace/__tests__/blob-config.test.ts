import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getWorkspaceBlobConfig,
  WorkspaceBlobConfigError,
} from "@/lib/workspace/blob-config";

const TOKEN_VAR = "WORKSPACE_BLOB_READ_WRITE_TOKEN";
const STORE_VAR = "WORKSPACE_BLOB_STORE_ID";

describe("getWorkspaceBlobConfig", () => {
  beforeEach(() => {
    delete process.env[TOKEN_VAR];
    delete process.env[STORE_VAR];
    delete process.env.VERCEL_TARGET_ENV;
    delete process.env.ACCEPTANCE_ENABLED_EXTERNAL_PROVIDERS;
  });

  afterEach(() => {
    delete process.env[TOKEN_VAR];
    delete process.env[STORE_VAR];
    delete process.env.VERCEL_TARGET_ENV;
    delete process.env.ACCEPTANCE_ENABLED_EXTERNAL_PROVIDERS;
  });

  it("returns the config when both variables are present", () => {
    process.env[TOKEN_VAR] = "ws-token-value";
    process.env[STORE_VAR] = "ws-store-value";

    const config = getWorkspaceBlobConfig();

    expect(config).toEqual({
      token: "ws-token-value",
      storeId: "ws-store-value",
    });
  });

  it("throws WorkspaceBlobConfigError when token is missing", () => {
    process.env[STORE_VAR] = "ws-store-value";

    expect(() => getWorkspaceBlobConfig()).toThrow(
      WorkspaceBlobConfigError,
    );
  });

  it("throws WorkspaceBlobConfigError when store ID is missing", () => {
    process.env[TOKEN_VAR] = "ws-token-value";

    expect(() => getWorkspaceBlobConfig()).toThrow(
      WorkspaceBlobConfigError,
    );
  });

  it("throws WorkspaceBlobConfigError when both variables are missing", () => {
    expect(() => getWorkspaceBlobConfig()).toThrow(
      WorkspaceBlobConfigError,
    );
  });

  it("rejects copied Workspace Blob credentials in Acceptance", () => {
    process.env[TOKEN_VAR] = "ws-token-value";
    process.env[STORE_VAR] = "ws-store-value";
    process.env.VERCEL_TARGET_ENV = "acceptance";

    expect(() => getWorkspaceBlobConfig()).toThrow(
      WorkspaceBlobConfigError,
    );
  });

  it("error message names the missing variable (token)", () => {
    process.env[STORE_VAR] = "ws-store-value";

    let caught: unknown;

    try {
      getWorkspaceBlobConfig();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(WorkspaceBlobConfigError);
    expect((caught as WorkspaceBlobConfigError).message).toContain(
      TOKEN_VAR,
    );
  });

  it("error message names the missing variable (store ID)", () => {
    process.env[TOKEN_VAR] = "ws-token-value";

    let caught: unknown;

    try {
      getWorkspaceBlobConfig();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(WorkspaceBlobConfigError);
    expect((caught as WorkspaceBlobConfigError).message).toContain(
      STORE_VAR,
    );
  });

  it("error message does not contain the token value", () => {
    process.env[TOKEN_VAR] = "ws-token-value";

    let caught: unknown;

    try {
      getWorkspaceBlobConfig();
    } catch (error) {
      caught = error;
    }

    expect((caught as WorkspaceBlobConfigError).message).not.toContain(
      "ws-token-value",
    );
  });

  it("does not fall back to BLOB_READ_WRITE_TOKEN", () => {
    process.env.BLOB_READ_WRITE_TOKEN = "public-store-token";
    process.env[STORE_VAR] = "ws-store-value";

    expect(() => getWorkspaceBlobConfig()).toThrow(
      WorkspaceBlobConfigError,
    );

    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it("does not fall back to BLOB_STORE_ID", () => {
    process.env[TOKEN_VAR] = "ws-token-value";
    process.env.BLOB_STORE_ID = "public-store-id";

    expect(() => getWorkspaceBlobConfig()).toThrow(
      WorkspaceBlobConfigError,
    );

    delete process.env.BLOB_STORE_ID;
  });
});
