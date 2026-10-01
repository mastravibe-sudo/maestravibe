// path: maestra-vibe/app/layout.tsx  (poori file replace karo)
import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { ColorModeProvider } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Maestra Vibe",
  description: "Apni vibe, apni profile.",
  appleWebApp: {
    capable: true,
    title: "Maestra Vibe",
    statusBarStyle: "default",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 antialiased">
        <ColorModeProvider>
          <AppShell>{children}</AppShell>
        </ColorModeProvider>
      </body>
    </html>
  );
}