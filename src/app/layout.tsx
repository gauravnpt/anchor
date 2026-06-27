import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anchor — AI Article Generator",
  description: "Generate fully researched, human-like articles that pass every AI detection tool.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
