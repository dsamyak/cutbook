// ─── Environment Validation ──────────────────────────────────────────────────
// Validates all required environment variables at import time.
// This module should be imported once in the client entry point so misconfig
// is caught immediately rather than at first Supabase call.

interface EnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

function getEnvVar(viteKey: string, nodeKey: string): string {
  if (import.meta.env && import.meta.env[viteKey]) {
    return import.meta.env[viteKey] as string;
  }
  if (typeof process !== 'undefined' && process.env && process.env[nodeKey]) {
    return process.env[nodeKey] as string;
  }
  return "";
}

function validateEnv(): EnvConfig {
  const supabaseUrl = getEnvVar("VITE_SUPABASE_URL", "SUPABASE_URL");
  const supabaseAnonKey = getEnvVar("VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY");

  const errors: string[] = [];

  if (!supabaseUrl) {
    errors.push("VITE_SUPABASE_URL / SUPABASE_URL is missing");
  } else {
    try {
      const url = new URL(supabaseUrl);
      if (!url.hostname.endsWith(".supabase.co")) {
        errors.push(
          `SUPABASE_URL has unexpected hostname: ${url.hostname}. Expected *.supabase.co`,
        );
      }
    } catch {
      errors.push(`SUPABASE_URL is not a valid URL: ${supabaseUrl}`);
    }
  }

  if (!supabaseAnonKey) {
    errors.push("VITE_SUPABASE_PUBLISHABLE_KEY / SUPABASE_PUBLISHABLE_KEY is missing");
  } else if (!supabaseAnonKey.startsWith("eyJ")) {
    errors.push("SUPABASE_PUBLISHABLE_KEY does not look like a valid JWT");
  }

  if (errors.length > 0) {
    const msg = `[Env Validation] Missing or invalid environment variables:\n${errors.map((e) => `  • ${e}`).join("\n")}`;
    console.error(msg);
    if (typeof window !== "undefined") {
      // Don't crash the entire app in the browser — show a user-friendly message
      console.error(
        "CutBook cannot connect to its backend. Contact the administrator.",
      );
    }
  }

  return { supabaseUrl, supabaseAnonKey };
}

export const env = validateEnv();
