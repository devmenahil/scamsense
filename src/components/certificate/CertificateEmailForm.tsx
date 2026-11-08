"use client";

import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { FeedbackBanner } from "@/components/ui/FeedbackBanner";
import { Input } from "@/components/ui/Input";

const emailSchema = z.email("Enter an email address like name@example.com.");

/**
 * Optional certificate email (R25). Phase 1 validates the address and explains that sending is not connected yet;
 * nothing is sent or stored. POST /api/certificates/[moduleKey]/email → Zapier replaces this in Phase 9.
 */
export function CertificateEmailForm() {
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    const parsed = emailSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      setNotice(false);
      return;
    }
    setError(undefined);
    setNotice(true);
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <Input
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        hint="Optional. Used only to send this certificate."
        error={error}
      />
      <Button type="submit" variant="secondary">
        Email my certificate
      </Button>
      {notice && (
        <FeedbackBanner tone="info" title="Not sent yet." live>
          Certificate email is connected in a later phase. Nothing was sent or stored.
        </FeedbackBanner>
      )}
    </form>
  );
}
