import { z } from "zod";
import { ageBracketSchema, displayNameSchema } from "@/lib/profile/schema";

/** Auth form validation, shared by the browser forms and the /api/auth/* route handlers. */

export const PASSWORD_MIN = 8;
/** bcrypt (used by Supabase Auth) only considers the first 72 bytes. */
export const PASSWORD_MAX = 72;

const emailSchema = z
  .string({ error: "Enter your email address." })
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter an email address like name@example.com.").max(254));

const newPasswordSchema = z
  .string({ error: "Choose a password." })
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
  .max(PASSWORD_MAX, `Use ${PASSWORD_MAX} characters or fewer.`);

export const signUpSchema = z
  .object({
    displayName: displayNameSchema,
    email: emailSchema,
    password: newPasswordSchema,
    ageBracket: ageBracketSchema.optional(),
    ageConfirmed: z.literal(true, {
      error: "Please confirm that you are at least 18 years old to create an account.",
    }),
  })
  .strict();
export type SignUpInput = z.output<typeof signUpSchema>;

export const signInSchema = z
  .object({
    email: emailSchema,
    password: z.string({ error: "Enter your password." }).min(1, "Enter your password.").max(200),
  })
  .strict();

export const forgotPasswordSchema = z.object({ email: emailSchema }).strict();

export const updatePasswordSchema = z
  .object({ password: newPasswordSchema, confirmPassword: z.string() })
  .strict()
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "The two passwords don't match.",
  });

/**
 * Only same-site relative paths are accepted as post-auth destinations, to prevent open redirects
 * (e.g. `?next=https://evil.example` or `//evil.example`).
 */
export function safeNextPath(next: unknown, fallback = "/dashboard"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (next.startsWith("/api/") || next.startsWith("/auth/")) return fallback;
  return next;
}
