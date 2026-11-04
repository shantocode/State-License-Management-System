import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "SLMS · State Licensing", template: "%s · SLMS" },
  description:
    "State Licensing Management System — authorized licensing, review, and revenue management.",
  robots: { index: false, follow: false },
  icons: { icon: "/state-logo.png" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="slms-theme" strategy="beforeInteractive">
          {`try { document.documentElement.classList.toggle("dark", localStorage.getItem("slms-theme") === "dark"); } catch {}`}
        </Script>
        {children}
      </body>
    </html>
  );
}
