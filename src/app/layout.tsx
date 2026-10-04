import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NegoZaar | AI Negotiation Platform for E-Commerce Merchants",
  description: "B2B SaaS AI-Powered Dynamic Price Negotiation Layer for Shopify and E-Commerce Merchants",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased font-sans bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
