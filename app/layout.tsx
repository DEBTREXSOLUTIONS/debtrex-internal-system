import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DEBTREX SOLUTIONS — Internal System",
  description: "Internal operations platform for DEBTREX SOLUTIONS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
