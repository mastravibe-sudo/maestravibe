export type PostType = "achievement" | "struggle" | "dream" | "vibe";

export const typeInfo: Record<PostType, { label: string; icon: string }> = {
  achievement: { label: "Achievement", icon: "🏆" },
  struggle: { label: "Struggle", icon: "💪" },
  dream: { label: "Dream", icon: "🌠" },
  vibe: { label: "Vibe", icon: "✨" },
};
