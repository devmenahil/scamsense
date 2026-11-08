"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { AGE_BRACKETS } from "@/content/profileOptions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { Checkbox, Input, Select } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

type Mode = "sign-in" | "sign-up";

const signInSchema = z.object({
  email: z.email("Enter an email address like name@example.com."),
  password: z.string().min(1, "Enter your password."),
});

const signUpSchema = signInSchema.extend({
  password: z.string().min(8, "Use at least 8 characters."),
  ageBracket: z.enum(AGE_BRACKETS.map((a) => a.value) as [string, ...string[]], {
    error: "Choose your age bracket.",
  }),
  adultConfirmed: z.literal(true, {
    error: "ScamSense is for adults. Confirm you are 18 or older to continue.",
  }),
});

type Errors = Partial<Record<"email" | "password" | "ageBracket" | "adultConfirmed", string>>;

/**
 * Sign-in / sign-up form shell. Phase 1 validates input on the client and continues to the next screen, but does
 * NOT create an account or store anything. Supabase Auth replaces the submit handler in Phase 2.
 */
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const isSignUp = mode === "sign-up";

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const values = {
      email: String(data.get("email") ?? "").trim(),
      password: String(data.get("password") ?? ""),
      ageBracket: String(data.get("ageBracket") ?? ""),
      adultConfirmed: data.get("adultConfirmed") === "on",
    };
    const result = (isSignUp ? signUpSchema : signInSchema).safeParse(values);
    if (!result.success) {
      const next: Errors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof Errors;
        next[key] ??= issue.message;
      }
      setErrors(next);
      const first = Object.keys(next)[0];
      if (first) e.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setErrors({});
    setSubmitting(true);
    router.push(isSignUp ? "/onboarding" : "/dashboard");
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

      <Card padding="lg">
        <h1 className="text-heading font-extrabold">{isSignUp ? "Start your training" : "Welcome back"}</h1>
        <p className="mt-2 text-teal/85">
          {isSignUp
            ? "Create an account to save your progress. ScamSense is for adults aged 18 and over."
            : "Sign in to pick up where you left off."}
        </p>

        <form noValidate onSubmit={onSubmit} className="mt-6 flex flex-col gap-5">
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
            hint={isSignUp ? "At least 8 characters. Use a password just for ScamSense." : undefined}
            error={errors.password}
            required
          />
          {isSignUp && (
            <>
              <Select
                label="Age bracket"
                name="ageBracket"
                defaultValue=""
                placeholder="Choose your age bracket"
                options={AGE_BRACKETS}
                error={errors.ageBracket}
                required
              />
              <Checkbox
                name="adultConfirmed"
                label="I confirm I am 18 or older."
                error={errors.adultConfirmed}
              />
            </>
          )}
          <Button type="submit" size="lg" fullWidth loading={submitting} loadingText="Continuing…">
            {isSignUp ? "Create account" : "Sign in"}
          </Button>
        </form>
      </Card>

      <DemoNotice className="mt-5">
        Accounts arrive in the next phase. Submitting checks your entries and continues, but no account is
        created and nothing is stored.
      </DemoNotice>
    </div>
  );
}
