import "server-only";
import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { fieldErrors } from "@/lib/profile/schema";
import {
  createSupabaseServerClient,
  SupabaseNotConfiguredError,
  type SupabaseServerClient,
} from "@/lib/supabase/server";

/**
 * Route-handler helpers. Error shape (ARCHITECTURE §5): `{ error: { code, message, fields? } }`.
 * Messages are written for people; internal details (stack traces, SQL, keys) never reach the response.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

const NO_STORE = { "Cache-Control": "private, no-store" };

export function json<T>(body: T, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) {
    return json(
      { error: { code: e.code, message: e.message, ...(e.fields ? { fields: e.fields } : {}) } },
      e.status,
    );
  }
  if (e instanceof SupabaseNotConfiguredError) {
    return json(
      {
        error: {
          code: "service_unavailable",
          message: "Accounts are temporarily unavailable. Please try again later.",
        },
      },
      503,
    );
  }
  // Log the error class only. Never log request bodies, emails, passwords, or tokens.
  console.error("[api] unexpected error", { name: e instanceof Error ? e.name : typeof e });
  return json(
    { error: { code: "internal", message: "Something went wrong on our side. Please try again." } },
    500,
  );
}

/** Parses a JSON body with a Zod schema, or throws a 400 ApiError with per-field messages. */
export async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError(400, "invalid_json", "We couldn't read that request. Please try again.");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ApiError(400, "validation", "Please check the highlighted fields.", fieldErrors(result.error));
  }
  return result.data;
}

/** Authenticates the caller from the cookie session (verified with Supabase Auth) or throws 401. */
export async function requireApiUser(): Promise<{ supabase: SupabaseServerClient; user: User }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new ApiError(401, "unauthenticated", "Your session has ended. Please sign in again.");
  }
  return { supabase, user: data.user };
}

/** Maps a PostgREST/Postgres error to a friendly ApiError. */
export function dbError(
  error: { code?: string; message?: string },
  /** What is unavailable when the table is missing, for the user-facing message. */
  subject = "Profiles",
): ApiError {
  console.error("[db] request failed", { code: error.code });
  switch (error.code) {
    case "23514": // check_violation
    case "22P02": // invalid_text_representation
    case "23502": // not_null_violation
      return new ApiError(
        400,
        "invalid_data",
        "Some of those details weren't accepted. Please review and try again.",
      );
    case "42501": // insufficient_privilege (RLS / grants)
      return new ApiError(403, "forbidden", "You don't have permission to change that.");
    case "PGRST116":
      return new ApiError(404, "not_found", "We couldn't find your profile. Please sign out and back in.");
    case "42P01": // undefined_table — migration not applied
    case "PGRST205":
      return new ApiError(
        503,
        "service_unavailable",
        `${subject} ${subject.endsWith("s") ? "are" : "is"} temporarily unavailable. Please try again later.`,
      );
    default:
      return new ApiError(
        503,
        "service_unavailable",
        "We couldn't save that right now. Please try again in a moment.",
      );
  }
}

/** Absolute origin for email links: NEXT_PUBLIC_APP_URL when set, otherwise the request's own origin. */
export function appOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}
