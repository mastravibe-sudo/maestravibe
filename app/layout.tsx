// path: maestra-vibe/app/layout.tsx  (poori file replace karo)
import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { StoreProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "Maestra Vibe",
  description: "Apni vibe, apni profile.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 antialiased">
        <StoreProvider>
          <AppShell>{children}</AppShell>
        </StoreProvider>
      </body>
    </html>
  );
}