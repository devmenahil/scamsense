"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { apiRequest } from "@/lib/api/client";
import { forgotPasswordSchema, PASSWORD_MIN, updatePasswordSchema } from "@/lib/auth/schema";
import { fieldErrors } from "@/lib/profile/schema";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FeedbackBanner } from "@/components/ui/FeedbackBanner";
import { Input } from "@/components/ui/Input";

/** Step 1 of password reset: request an email link (Supabase sends it). */
export function ForgotPasswordForm() {
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = forgotPasswordSchema.safeParse({
      email: String(new FormData(e.currentTarget).get("email") ?? ""),
    });
    if (!parsed.success) {
      setError(fieldErrors(parsed.error).email);
      e.currentTarget.querySelector<HTMLElement>('[name="email"]')?.focus();
      return;
    }
    setError(undefined);
    setFormError(null);
    setSubmitting(true);
    const result = await apiRequest("/api/auth/forgot-password", {
      method: "POST",
      body: parsed.data,
      redirectOnUnauthenticated: false,
    });
    setSubmitting(false);
    if (!result.ok) setFormError(result.error.message);
    else setSent(true);
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Card padding="lg">
        <h1 className="text-heading font-extrabold">Reset your password</h1>
        {sent ? (
          <>
            <p className="mt-3" role="status">
              If an account exists for that email, a reset link is on its way. Open it on this device to
              choose a new password.
            </p>
            <p className="mt-3 text-small text-teal/85">Can&apos;t find it? Check your spam folder.</p>
          </>
        ) : (
          <>
            <p className="mt-2 text-teal/85">
              Enter your account email and we&apos;ll send you a reset link.
            </p>
            {formError && (
              <div className="mt-5">
                <FeedbackBanner tone="look-again" title="Look again." live>
                  {formError}
                </FeedbackBanner>
              </div>
            )}
            <form noValidate onSubmit={onSubmit} className="mt-6 flex flex-col gap-5">
              <Input
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                error={error}
                required
              />
              <Button type="submit" size="lg" fullWidth loading={submitting} loadingText="Sending…">
                Send reset link
              </Button>
            </form>
          </>
        )}
        <p className="mt-6 text-small">
          <Link href="/sign-in" className="font-heading font-extrabold underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}

/** Step 2 of password reset: choose a new password while holding the recovery session. */
export function ResetPasswordForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const parsed = updatePasswordSchema.safeParse({
      password: String(data.get("password") ?? ""),
      confirmPassword: String(data.get("confirmPassword") ?? ""),
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setFormError(null);
    setSubmitting(true);
    const result = await apiRequest("/api/auth/update-password", { method: "POST", body: parsed.data });
    if (!result.ok) {
      setSubmitting(false);
      if (result.error.fields) setErrors(result.error.fields);
      setFormError(result.error.message);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Card padding="lg">
        <h1 className="text-heading font-extrabold">Choose a new password</h1>
        <p className="mt-2 text-teal/85">Use at least {PASSWORD_MIN} characters, just for ScamSense.</p>
        {formError && (
          <div className="mt-5">
            <FeedbackBanner tone="look-again" title="Look again." live>
              {formError}
            </FeedbackBanner>
          </div>
        )}
        <form noValidate onSubmit={onSubmit} className="mt-6 flex flex-col gap-5">
          <Input
            label="New password"
            name="password"
            type="password"
            autoComplete="new-password"
            error={errors.password}
            required
          />
          <Input
            label="Confirm new password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword}
            required
          />
          <Button type="submit" size="lg" fullWidth loading={submitting} loadingText="Saving…">
            Save new password
          </Button>
        </form>
      </Card>
    </div>
  );
}
