
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EM ROUNDS with PK | Emergency Medicine Education",
  description:
    "A structured medical education platform for emergency medicine learning and practice.",
  applicationName: "EM ROUNDS with PK",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
