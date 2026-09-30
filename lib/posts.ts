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
  p("p1", "bilal", "achievement", "Aaj hamari dukaan ko 5 saal poore hue. Shuru mein sirf 1 customer tha, aaj 300+ hain. 🙏", "2 ghante pehle", 128),
  p("p2", "ali", "struggle", "Car ke liye is mahine 20% target poora hua. Slow hai lekin ruk nahi raha.", "4 ghante pehle", 76),
  p("p3", "sara", "dream", "Mera khwab hai apna design studio kholna. Is saal ka pehla step: portfolio website.", "6 ghante pehle", 94),
  p("p4", "nova", "vibe", "Naya logo aur naya rang, hamari vibe ab ocean blue. 🌊 Aap ki profile ka kya rang hai?", "kal", 52),
  p("p5", "sara", "vibe", "Sunday vibes: coffee, music aur naye designs. ☕", "kal", 41),
  p("p6", "ali", "achievement", "Maestra Vibe ka pehla design mukammal! 🚀", "2 din pehle", 210),
];