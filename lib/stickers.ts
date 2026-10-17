// path: maestra-vibe/lib/stickers.ts  (NEW file)
// Comments ke stickers (apne bane hue SVG, koi copyright nahi) aur emoji list.
// Sticker comment ki body mein "::sticker:<id>::" ke tor par save hota hai.

const svg = (body: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`)}`;

export const STICKERS: { id: string; label: string; src: string }[] = [
  { id: "star", label: "Star", src: svg('<path d="M32 4l8.6 17.4 19.2 2.8-13.9 13.5 3.3 19.1L32 47.8 14.8 56.8l3.3-19.1L4.2 24.2l19.2-2.8z" fill="#facc15" stroke="#a16207" stroke-width="3" stroke-linejoin="round"/>') },
  { id: "heart", label: "Heart", src: svg('<path d="M32 56S6 40 6 22a13 13 0 0 1 26-4 13 13 0 0 1 26 4c0 18-26 34-26 34z" fill="#f43f5e" stroke="#9f1239" stroke-width="3" stroke-linejoin="round"/>') },
  { id: "bolt", label: "Bolt", src: svg('<path d="M36 4L12 36h16l-4 24 28-34H36z" fill="#fbbf24" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/>') },
  { id: "flame", label: "Flame", src: svg('<path d="M32 4c4 10 16 16 16 32a16 16 0 0 1-32 0c0-8 4-12 8-16 0 6 4 8 6 8-2-10 0-18 2-24z" fill="#fb923c" stroke="#c2410c" stroke-width="3" stroke-linejoin="round"/>') },
  { id: "crown", label: "Crown", src: svg('<path d="M6 48L10 18l14 14 8-18 8 18 14-14 4 30z" fill="#fcd34d" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/>') },
  { id: "diamond", label: "Diamond", src: svg('<path d="M32 6l22 20-22 32L10 26z" fill="#60a5fa" stroke="#1d4ed8" stroke-width="3" stroke-linejoin="round"/>') },
  { id: "check", label: "Done", src: svg('<circle cx="32" cy="32" r="26" fill="#22c55e" stroke="#15803d" stroke-width="3"/><path d="M19 33l9 9 17-19" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>') },
  { id: "wow", label: "Wow", src: svg('<polygon points="32,2 38,14 51,8 49,22 62,26 52,35 60,47 46,47 44,60 32,52 20,60 18,47 4,47 12,35 2,26 15,22 13,8 26,14" fill="#f472b6" stroke="#9d174d" stroke-width="2.5"/><text x="32" y="38" font-size="15" font-weight="800" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif">WOW</text>') },
];

export const EMOJIS = "😀 😂 🥹 😍 🥰 😎 🤩 😭 😅 😉 🙏 👏 🙌 👍 👌 💪 🔥 ✨ ⭐ 💯 🎉 🎊 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 😡 🤔 😴 🤯 🥳 😇 🤝 👀 🚀 🌙 ☀️ 🌈 🍀 🎯 🏆 💎 👑".split(" ");

export const stickerToken = (id: string) => `::sticker:${id}::`;
export const stickerOf = (body: string) => {
  const m = /^::sticker:([a-z]+)::$/.exec(body.trim());
  return m ? STICKERS.find((s) => s.id === m[1]) ?? null : null;
};