/**
 * Browser fetch wrapper for ScamSense API routes. Always resolves (never throws) with either data or a friendly
 * error, so forms can show a calm message for network failures, expired sessions, and server errors alike.
 */
export interface ApiFailure {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiFailure };

const NETWORK_ERROR: ApiFailure = {
  code: "network",
  message: "We couldn't reach ScamSense. Check your internet connection and try again.",
};

export async function apiRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH";
    body?: unknown;
    redirectOnUnauthenticated?: boolean;
  } = {},
): Promise<ApiResult<T>> {
  const { method = "GET", body, redirectOnUnauthenticated = true } = options;
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // Non-JSON (e.g. a proxy error page): handled below.
  }

  if (res.ok) return { ok: true, data: payload as T };

  const error = (payload as { error?: ApiFailure } | null)?.error ?? {
    code: "unknown",
    message: "Something went wrong. Please try again.",
  };
  if (res.status === 401 && redirectOnUnauthenticated && typeof window !== "undefined") {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.assign(`/sign-in?notice=expired&next=${next}`);
  }
  return { ok: false, error };
}
