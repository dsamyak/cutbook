import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

// ─── Security Headers ────────────────────────────────────────────────────────
// Applied programmatically to ALL responses (SSR, API, static) at the edge.
// These supplement the static `public/_headers` file which Cloudflare Pages
// serves for static assets. Workers-served responses need them injected here.
const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-XSS-Protection": "1; mode=block",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "Cross-Origin-Opener-Policy": "same-origin",
};

function applySecurityHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!newHeaders.has(key)) {
      newHeaders.set(key, value);
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

// ─── Request Validation ──────────────────────────────────────────────────────
// Block obviously malicious or oversized requests before they hit the app.
const MAX_URL_LENGTH = 4096;
const MAX_BODY_SIZE = 2 * 1024 * 1024; // 2 MB

function validateRequest(request: Request): Response | null {
  // Block excessively long URLs (path traversal, injection attempts)
  if (request.url.length > MAX_URL_LENGTH) {
    return new Response("URI Too Long", { status: 414 });
  }

  // Block oversized request bodies
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return new Response("Payload Too Large", { status: 413 });
  }

  // Block requests with suspicious path patterns
  const url = new URL(request.url);
  const dangerousPatterns = [
    /\.\.\//,           // Path traversal
    /\/\.env/i,         // Env file probing
    /\/\.git/i,         // Git directory probing
    /\/wp-admin/i,      // WordPress scanner
    /\/phpmy/i,         // phpMyAdmin scanner
    /\/eval\(/i,        // Code injection
    /\<script/i,        // XSS in URL
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(url.pathname) || pattern.test(url.search)) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  return null; // Request is valid
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // ── Pre-flight validation ──────────────────────────────────────────
      const blocked = validateRequest(request);
      if (blocked) return applySecurityHeaders(blocked);

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);

      // ── Apply security headers to every response ───────────────────────
      return applySecurityHeaders(normalized);
    } catch (error) {
      console.error(error);
      return applySecurityHeaders(brandedErrorResponse());
    }
  },
};
