/**
 * Maps Supabase Auth errors to calm, user-facing messages (pure, unit-tested). Raw Auth messages are never shown,
 * except Supabase's password-strength reasons, which are already written for users.
 */
export interface FriendlyError {
  status: number;
  code: string;
  message: string;
  field?: "email" | "password" | "displayName";
}

interface AuthErrorLike {
  code?: string | undefined;
  status?: number | undefined;
  name?: string | undefined;
  message?: string | undefined;
}

export const DUPLICATE_EMAIL_MESSAGE =
  "An account with this email already exists. Try signing in, or reset your password if you've forgotten it.";

export function friendlyAuthError(
  error: AuthErrorLike,
  context: "sign-up" | "sign-in" | "reset" | "update",
): FriendlyError {
  if (error.name === "AuthRetryableFetchError" || error.status === 0 || error.status === undefined) {
    return {
      status: 503,
      code: "network",
      message: "We couldn't reach the account service. Check your connection and try again.",
    };
  }
  switch (error.code) {
    case "user_already_exists":
    case "email_exists":
      return { status: 409, code: "duplicate_email", message: DUPLICATE_EMAIL_MESSAGE, field: "email" };
    case "invalid_credentials":
      return {
        status: 401,
        code: "invalid_credentials",
        message: "That email and password don't match an account. Check them and try again.",
      };
    case "email_not_confirmed":
      return {
        status: 403,
        code: "email_not_confirmed",
        message: "Please confirm your email first. Check your inbox for the confirmation link.",
      };
    case "weak_password":
      return {
        status: 400,
        code: "weak_password",
        message: "Please choose a stronger password: longer, and harder to guess.",
        field: "password",
      };
    case "same_password":
      return {
        status: 400,
        code: "same_password",
        message: "Choose a new password that's different from your current one.",
        field: "password",
      };
    case "email_address_invalid":
      return {
        status: 400,
        code: "invalid_email",
        message: "Please use a different email address.",
        field: "email",
      };
    case "signup_disabled":
    case "email_provider_disabled":
      return { status: 403, code: "signup_disabled", message: "New accounts can't be created right now." };
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return {
        status: 429,
        code: "rate_limited",
        message: "Too many attempts in a short time. Please wait a few minutes and try again.",
      };
    case "session_expired":
    case "session_not_found":
    case "refresh_token_not_found":
      return {
        status: 401,
        code: "unauthenticated",
        message: "Your session has ended. Please sign in again.",
      };
  }
  if (error.status === 429) {
    return {
      status: 429,
      code: "rate_limited",
      message: "Too many attempts. Please wait a few minutes and try again.",
    };
  }
  if (context === "sign-in" && error.status === 400) {
    return {
      status: 401,
      code: "invalid_credentials",
      message: "That email and password don't match an account. Check them and try again.",
    };
  }
  return {
    status: 500,
    code: "auth_failed",
    message:
      context === "sign-up"
        ? "We couldn't create your account right now. Please try again in a moment."
        : "Something went wrong. Please try again in a moment.",
  };
}
