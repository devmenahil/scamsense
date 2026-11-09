/**
 * Runs once when the Next.js server starts. Validates the server environment immediately, so a Live PayPal
 * configuration (PAYPAL_ENV ≠ sandbox or a non-Sandbox PAYPAL_API_BASE) stops the server at startup instead of at the
 * first payment request (R28, R31). The error lists the invalid variable names only, never their values.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { parseEnv, serverEnvSchema } = await import("./lib/env.schema");
  parseEnv(serverEnvSchema, process.env);
}
