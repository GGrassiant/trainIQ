"use client";

import { useSearchParams } from "next/navigation";

export function AuthNotice() {
  const status = useSearchParams().get("auth");
  let message: string | null = null;
  if (status === "login-failed")
    message = "Sign-in failed or expired. Please try again.";
  if (status === "logout-incomplete")
    message =
      "Signed out on this browser. Server revocation could not be confirmed.";
  if (!message) return null;
  return (
    <p role="status" className="mx-auto w-full max-w-2xl px-4 pt-2 text-sm">
      {message}
    </p>
  );
}
