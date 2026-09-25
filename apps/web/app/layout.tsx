import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { AuthStatus } from "../components/auth-status";
import { AuthNotice } from "../components/auth-notice";
import { appRouter } from "../lib/server/trpc/router";
import { getServerTRPCContext } from "../lib/server/trpc/server-context";

async function ServerAuthStatus() {
  const user = await appRouter
    .createCaller(await getServerTRPCContext())
    .auth.me();
  return <AuthStatus signedIn={!!user} />;
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TrainIQ",
  description: "Plan your next week of training.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body suppressHydrationWarning>
        <Suspense fallback={null}>
          <ServerAuthStatus />
        </Suspense>
        <Suspense fallback={null}>
          <AuthNotice />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
