// path: maestra-vibe/lib/posts.ts  (poori file replace karo)

export type PostType = "achievement" | "struggle" | "dream" | "vibe";

export type Post = {
  id: string;
  username: string;
  type: PostType;
  text: string;
  time: string;
  vibes: number; // purane demo counts
  vibed: string[]; // jin users ne Vibe/Support diya
  image?: string;
  repostOf?: string; // repost / quote ki original post id
};

export const typeInfo: Record<PostType, { label: string; icon: string }> = {
  achievement: { label: "Achievement", icon: "🏆" },
  struggle: { label: "Struggle", icon: "💪" },
  dream: { label: "Dream", icon: "🌠" },
  vibe: { label: "Vibe", icon: "✨" },
};

const p = (id: string, username: string, type: PostType, text: string, time: string, vibes: number): Post => ({
  id, username, type, text, time, vibes, vibed: [],
});

export const initialPosts: Post[] = [
  p("p1", "bilal", "achievement", "Our shop turned 5 years old today. We started with 1 customer and now serve 300+. 🙏", "2h ago", 128),
  p("p2", "ali", "struggle", "Hit 20% of my car fund this month. Slow, but I'm not stopping.", "4h ago", 76),
  p("p3", "sara", "dream", "My dream is to open my own design studio. This year's first step: a portfolio website.", "6h ago", 94),
  p("p4", "nova", "vibe", "New logo, new color: our vibe is now ocean blue. 🌊 What color is your profile?", "yesterday", 52),
  p("p5", "sara", "vibe", "Sunday vibes: coffee, music and new designs. ☕", "yesterday", 41),
  p("p6", "ali", "achievement", "First Maestra Vibe design complete! 🚀", "2d ago", 210),
];