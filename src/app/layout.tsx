import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lateris Trace",
  description: "Platforma de trasabilitate a materialelor in economia circulara",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}
