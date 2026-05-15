// Server-side auth middleware for TanStack Start server functions.
// Validates Bearer tokens from the Authorization header and creates
// a per-request Supabase client scoped to that user's session.
//
// SECURITY:
//   - Never leaks internal error details to the client
//   - All auth errors return a generic "Unauthorized" message
//   - Token validation uses Supabase's built-in JWT verification
import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

import { env } from '@/lib/env';

const GENERIC_AUTH_ERROR = 'Unauthorized';

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    
    const SUPABASE_URL = env.supabaseUrl;
    const SUPABASE_PUBLISHABLE_KEY = env.supabaseAnonKey;

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      console.error('[Auth Middleware] Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY');
      throw new Error(GENERIC_AUTH_ERROR);
    }
    
    const request = getRequest();

    if (!request?.headers) {
      throw new Error(GENERIC_AUTH_ERROR);
    }

    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error(GENERIC_AUTH_ERROR);
    }

    const token = authHeader.slice(7); // 'Bearer '.length === 7
    if (!token || token.length < 10) {
      throw new Error(GENERIC_AUTH_ERROR);
    }

    const supabase = createClient<Database>(
      SUPABASE_URL!,
      SUPABASE_PUBLISHABLE_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims) {
      // Log the real error server-side for debugging, but don't send to client
      if (error) console.error('[Auth Middleware] Token validation failed:', error.message);
      throw new Error(GENERIC_AUTH_ERROR);
    }

    if (!data.claims.sub) {
      console.error('[Auth Middleware] Token missing sub claim');
      throw new Error(GENERIC_AUTH_ERROR);
    }

    return next({
      context: {
        supabase,
        userId: data.claims.sub,
        claims: data.claims,
      },
    });
  },
);
