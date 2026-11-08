import "server-only";
import { parseEnv, serverEnvSchema, type ServerEnv } from "./env.schema";

let cached: ServerEnv | undefined;

/** Server-side environment, validated once on first use. Never import this from client components. */
export function getServerEnv(): ServerEnv {
  cached ??= parseEnv(serverEnvSchema, process.env);
  return cached;
}
