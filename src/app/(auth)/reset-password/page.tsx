import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/PasswordForms";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Choose a new password" };

/** Reached from the password-reset email link (/auth/confirm signs the user in with a recovery session first). */
export default async function ResetPasswordPage() {
  await requireUser("/reset-password");
  return <ResetPasswordForm />;
}
