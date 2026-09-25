import { expect, it, vi } from "vitest";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config } from "../../../proxy";

vi.mock("server-only", () => ({}));

// This installed Next version still exports the utility under its Middleware name.
it.each([
  "/",
  "/settings",
  "/unknown/deep/page",
  "/unknown.svg",
  "/api/trpc/auth.me",
  "/auth/callback",
  "/_next/image-other",
])(
  "covers application route %s before the root layout reads identity",
  (url) => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(
      true
    );
  }
);

it.each([
  "/_next/static/chunks/app.js",
  "/_next/image?url=test&w=32&q=75",
  "/favicon.ico",
  "/file.svg",
  "/globe.svg",
  "/next.svg",
  "/vercel.svg",
  "/window.svg",
])("excludes static/internal resource %s", (url) => {
  expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(
    false
  );
});
