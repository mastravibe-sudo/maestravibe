import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Maestra Vibe",
    short_name: "Maestra",
    description: "Your profile, your community, your vibe.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    categories: ["social"],
    background_color: "#07061a",
    theme_color: "#7c3aed",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    screenshots: [
      { src: "/screenshots/home.png", sizes: "1080x1920", type: "image/png", form_factor: "narrow" },
      { src: "/screenshots/inbox.png", sizes: "1080x1920", type: "image/png", form_factor: "narrow" },
      { src: "/screenshots/profile.png", sizes: "1080x1920", type: "image/png", form_factor: "narrow" },
    ],
    shortcuts: [
      { name: "Inbox", url: "/inbox", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Notifications", url: "/notifications", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
