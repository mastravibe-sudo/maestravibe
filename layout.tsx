// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/app/components/header"; // your Header component
import Footer from "@/app/components/footer"; // your Footer component
import "./globals.css";
 
// Google Fonts
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
 
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
 
// Metadata
export const metadata: Metadata = {
  title: "Maestravibe hg",
  icons :{
    icon: "/imag/maestravibe logo.jpg"  
  }
};
 
// Root Layout
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen flex flex-col">
        {/* Header shows on every page */}
        <Header />
 
        {/* Main content grows to fill screen */}
        <main className="flex-grow">{children}</main>
 
        {/* Footer shows on every page */}
        <Footer />
      </body>
    </html>
  );
}