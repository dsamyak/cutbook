// ─── Environment Validation ──────────────────────────────────────────────────
// Validates all required environment variables at import time.
// This module should be imported once in the client entry point so misconfig
// is caught immediately rather than at first Supabase call.

interface EnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

function validateEnv(): EnvConfig {
  const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseAnonKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    "";

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
