"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AGE_BRACKETS, DISPLAY_NAME_MAX } from "@/content/profileOptions";
import { apiRequest } from "@/lib/api/client";
import { PASSWORD_MIN, safeNextPath, signInSchema, signUpSchema } from "@/lib/auth/schema";
import { fieldErrors } from "@/lib/profile/schema";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FeedbackBanner } from "@/components/ui/FeedbackBanner";
import { Checkbox, Input, Select } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { AuthNotice, type NoticeKey } from "./AuthNotice";

type Mode = "sign-in" | "sign-up";
type Errors = Partial<Record<"displayName" | "email" | "password" | "ageBracket" | "ageConfirmed", string>>;

const AGE_OPTIONS = [{ value: "", label: "Prefer not to say" }, ...AGE_BRACKETS];

/**
 * Sign-in / sign-up form backed by Supabase Auth via /api/auth/*. Validates in the browser for fast feedback; the
 * server validates again and Supabase stores the credentials (no password ever touches ScamSense tables).
 */
export function AuthForm({ mode, next, notice }: { mode: Mode; next?: string; notice?: NoticeKey }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);
  const isSignUp = mode === "sign-up";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const values = isSignUp
      ? {
          displayName: String(data.get("displayName") ?? ""),
          email: String(data.get("email") ?? ""),
          password: String(data.get("password") ?? ""),
          ageBracket: String(data.get("ageBracket") ?? "") || null,
          ageConfirmed: data.get("ageConfirmed") === "on",
        }
      : { email: String(data.get("email") ?? ""), password: String(data.get("password") ?? "") };

    const parsed = (isSignUp ? signUpSchema : signInSchema).safeParse(values);
    if (!parsed.success) {
      showErrors(form, fieldErrors(parsed.error) as Errors);
      return;
    }

    setErrors({});
    setFormError(null);
    setSubmitting(true);
    const result = await apiRequest<{ status?: string; onboarded?: boolean }>(`/api/auth/${mode}`, {
      method: "POST",
      body: parsed.data,
      redirectOnUnauthenticated: false,
    });

    if (!result.ok) {
      setSubmitting(false);
      if (result.error.fields) showErrors(form, result.error.fields as Errors);
      setFormError(result.error.message);
      return;
    }

    if (isSignUp && result.data.status === "confirmation_required") {
      setSubmitting(false);
      setConfirmationSentTo(String(values.email).trim());
      return;
    }

    const destination = isSignUp
      ? "/onboarding"
      : result.data.onboarded
        ? safeNextPath(next, "/dashboard")
        : "/onboarding";
    router.replace(destination);
    router.refresh();
  }

  function showErrors(form: HTMLFormElement, found: Errors) {
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }

  if (confirmationSentTo) {
    return (
      <div className="mx-auto w-full max-w-md">
        <Card padding="lg">
          <h1 className="text-heading font-extrabold">Check your inbox</h1>
          <p className="mt-3" role="status">
            We sent a confirmation link to <strong className="break-all">{confirmationSentTo}</strong>. Open
            it on this device to confirm your account, then you&apos;ll continue to set up your profile.
          </p>
          <p className="mt-3 text-small text-teal/85">
            Can&apos;t find it? Check your spam folder, or wait a minute and try signing up again.
          </p>
          <div className="mt-6">
            <Link href="/sign-in" className="font-heading font-extrabold underline underline-offset-4">
              Back to sign in
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <nav
        aria-label="Account"
        className="mb-5 grid grid-cols-2 rounded-pill border-2 border-teal bg-white p-1"
      >
        {(["sign-up", "sign-in"] as const).map((m) => (
          <Link
            key={m}
            href={`/${m}`}
            aria-current={mode === m ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center justify-center rounded-pill px-3 label-button text-button",
              mode === m ? "bg-teal text-white" : "text-teal hover:bg-mist",
            )}
          >
            {m === "sign-up" ? "Create account" : "Sign in"}
          </Link>
        ))}
      </nav>

      {notice && <AuthNotice notice={notice} className="mb-5" />}

      <Card padding="lg">
        <h1 className="text-heading font-extrabold">{isSignUp ? "Start your training" : "Welcome back"}</h1>
        <p className="mt-2 text-teal/85">
          {isSignUp
            ? "Create an account to save your profile and progress."
            : "Sign in to pick up where you left off."}
        </p>

        {formError && (
          <div className="mt-5" aria-live="assertive">
            <FeedbackBanner tone="look-again" title="Look again." live>
              {formError}
            </FeedbackBanner>
          </div>
        )}

        <form noValidate onSubmit={onSubmit} className="mt-6 flex flex-col gap-5">
          {isSignUp && (
            <Input
              label="Display name"
              name="displayName"
              autoComplete="nickname"
              maxLength={DISPLAY_NAME_MAX}
              hint="Shown on your certificate and in feedback. You can change it later."
              error={errors.displayName}
              required
            />
          )}
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            error={errors.email}
            required
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            hint={
              isSignUp ? `At least ${PASSWORD_MIN} characters. Use a password just for ScamSense.` : undefined
            }
            error={errors.password}
            required
          />
          {!isSignUp && (
            <p className="-mt-2 text-small">
              <Link href="/forgot-password" className="font-semibold underline underline-offset-4">
                Forgot your password?
              </Link>
            </p>
          )}
          {isSignUp && (
            <>
              <Select
                label="Age bracket"
                name="ageBracket"
                optional
                defaultValue=""
                options={AGE_OPTIONS}
                error={errors.ageBracket}
              />
              <Checkbox
                name="ageConfirmed"
                label="I confirm that I am at least 18 years old."
                error={errors.ageConfirmed}
                required
              />
            </>
          )}
          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={submitting}
            loadingText={isSignUp ? "Creating account…" : "Signing in…"}
          >
            {isSignUp ? "Create account" : "Sign in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
