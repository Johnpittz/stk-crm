import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve in time,
 * returns the fallback value instead of failing the entire request.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refreshing the auth token with a 3s timeout.
  // If Supabase is slow, we proceed anyway — the client-side auth
  // will still work and refresh the session on the next call.
  // This prevents MIDDLEWARE_INVOCATION_TIMEOUT (504) on Vercel.
  await withTimeout(supabase.auth.getUser(), 3000, null);

  return response;
}
