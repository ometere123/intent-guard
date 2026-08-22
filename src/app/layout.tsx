import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "Intent Guard",
    template: "%s · Intent Guard",
  },
  description:
    "Do these bytes do what that text said? Intent Guard reads a governance proposal's mandate and its decoded calldata side by side, and raises an objection when they diverge.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
    >
      <body className="ig-verso ig-body antialiased">
        <a href="#main" className="ig-skip ig-label ig-label-ink">
          skip to the apparatus
        </a>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
