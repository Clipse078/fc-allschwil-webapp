const CSP_REPORT_CONTENT_TYPE = "application/csp-report";
const MAX_REPORT_BYTES = 16 * 1024;
const MAX_LOGS_PER_WINDOW = 20;
const LOG_WINDOW_MS = 60_000;
const MAX_LOG_VALUE_LENGTH = 512;
const INVALID_URL_LOG_VALUE = "[invalid-url]";
const SAFE_CSP_SOURCE_VALUES = new Set([
  "eval",
  "inline",
  "self",
  "wasm-eval",
]);

type JsonObject = Record<string, unknown>;

let logWindowStartedAt = 0;
let logsInWindow = 0;

function emptyResponse(status: number) {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeLogValue(value: unknown): string | number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  return value
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ")
    .slice(0, MAX_LOG_VALUE_LENGTH);
}

function sanitizeUrlLogValue(
  value: unknown,
  allowCspSourceValue = false,
): string | undefined {
  const sanitized = sanitizeLogValue(value);
  if (typeof sanitized !== "string") {
    return undefined;
  }

  const candidate = sanitized.trim();
  if (!candidate) {
    return INVALID_URL_LOG_VALUE;
  }

  const normalizedSource = candidate.toLowerCase();
  if (allowCspSourceValue && SAFE_CSP_SOURCE_VALUES.has(normalizedSource)) {
    return normalizedSource;
  }

  // CSP blocked-uri commonly contains only a scheme (for example "data:").
  if (
    allowCspSourceValue &&
    /^[a-z][a-z0-9+.-]*:$/i.test(candidate)
  ) {
    return normalizedSource;
  }

  try {
    const isRelative = candidate.startsWith("/");
    const url = isRelative
      ? new URL(candidate, "https://csp-report.invalid")
      : new URL(candidate);

    if (isRelative) {
      return url.pathname.slice(0, MAX_LOG_VALUE_LENGTH);
    }

    if (url.protocol === "http:" || url.protocol === "https:") {
      // URL.origin intentionally excludes username/password components.
      return `${url.origin}${url.pathname}`.slice(0, MAX_LOG_VALUE_LENGTH);
    }

    if (url.protocol === "blob:") {
      const nestedUrl = sanitizeUrlLogValue(url.pathname);
      return nestedUrl && nestedUrl !== INVALID_URL_LOG_VALUE
        ? `blob:${nestedUrl}`.slice(0, MAX_LOG_VALUE_LENGTH)
        : "blob:";
    }

    // Non-hierarchical schemes can embed arbitrary data. The scheme alone is
    // sufficient to classify a CSP violation without retaining its payload.
    return url.protocol.toLowerCase().slice(0, MAX_LOG_VALUE_LENGTH);
  } catch {
    return INVALID_URL_LOG_VALUE;
  }
}

function parseCspReport(body: string): JsonObject | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }

  if (!isJsonObject(parsed) || !isJsonObject(parsed["csp-report"])) {
    return null;
  }

  const report = parsed["csp-report"];
  const violatedDirective =
    sanitizeLogValue(report["effective-directive"]) ??
    sanitizeLogValue(report["violated-directive"]);

  if (typeof violatedDirective !== "string" || violatedDirective.length === 0) {
    return null;
  }

  const safeReport: JsonObject = {
    "effective-directive": sanitizeLogValue(report["effective-directive"]),
    "violated-directive": sanitizeLogValue(report["violated-directive"]),
    "blocked-uri": sanitizeUrlLogValue(report["blocked-uri"], true),
    "document-uri": sanitizeUrlLogValue(report["document-uri"]),
    disposition: sanitizeLogValue(report.disposition),
    "source-file": sanitizeUrlLogValue(report["source-file"]),
    "status-code": sanitizeLogValue(report["status-code"]),
    "line-number": sanitizeLogValue(report["line-number"]),
    "column-number": sanitizeLogValue(report["column-number"]),
  };

  return Object.fromEntries(
    Object.entries(safeReport).filter(([, value]) => value !== undefined),
  );
}

function logCspReport(report: JsonObject) {
  const now = Date.now();

  if (now - logWindowStartedAt >= LOG_WINDOW_MS) {
    logWindowStartedAt = now;
    logsInWindow = 0;
  }

  if (logsInWindow >= MAX_LOGS_PER_WINDOW) {
    return;
  }

  logsInWindow += 1;
  console.warn("[csp-report]", JSON.stringify(report));
}

async function readBoundedBody(request: Request): Promise<string | null> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const parsedLength = Number(contentLength);
    if (
      !Number.isSafeInteger(parsedLength) ||
      parsedLength < 0 ||
      parsedLength > MAX_REPORT_BYTES
    ) {
      await request.body?.cancel().catch(() => undefined);
      return null;
    }
  }

  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    totalBytes += value.byteLength;
    if (totalBytes > MAX_REPORT_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }

    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(body);
}

export async function POST(request: Request) {
  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();

  if (contentType !== CSP_REPORT_CONTENT_TYPE) {
    return emptyResponse(415);
  }

  const body = await readBoundedBody(request);
  if (body === null) {
    return emptyResponse(413);
  }

  const report = parseCspReport(body);
  if (!report) {
    return emptyResponse(400);
  }

  logCspReport(report);
  return emptyResponse(204);
}
