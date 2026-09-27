import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "SLMS · State Licensing", template: "%s · SLMS" },
  description:
    "State Licensing Management System — authorized licensing, review, and revenue management.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
