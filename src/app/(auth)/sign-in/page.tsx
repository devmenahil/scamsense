import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { toNoticeKey } from "@/components/auth/AuthNotice";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  return <AuthForm mode="sign-in" next={next} notice={toNoticeKey(params.notice)} />;
}
