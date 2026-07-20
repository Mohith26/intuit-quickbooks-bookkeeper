import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoLedger",
  description: "Landlord bookkeeping automation on the QuickBooks Online API shape",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <nav style={{ display: "flex", gap: "1.5rem", padding: "1rem 2rem", borderBottom: "1px solid #333" }}>
          <a href="/">AutoLedger</a>
          <a href="/queue">Review Queue</a>
          <a href="/reports">Reports</a>
          <a href="/close">Month-End Close</a>
        </nav>
        <main style={{ padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>{children}</main>
      </body>
    </html>
  );
}
