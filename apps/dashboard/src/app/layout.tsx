import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clerkey Owner Dashboard",
  description: "Multi-tenant AI customer response agent platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
