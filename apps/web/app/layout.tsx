import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TrainIQ",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
