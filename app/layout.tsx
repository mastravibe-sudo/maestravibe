// path: maestra-vibe/app/layout.tsx  (poori file replace karo)
import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { ColorModeProvider } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Maestra Vibe",
  description: "Apni vibe, apni profile.",
  robots: { index: false, follow: true },
  appleWebApp: {
    capable: true,
    title: "Maestra Vibe",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
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