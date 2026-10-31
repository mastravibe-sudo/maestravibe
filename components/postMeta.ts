// path: maestra-vibe/components/postMeta.ts  (poori file replace karo)
import { Flame, Mountain, Sparkles, Trophy, type LucideIcon } from "lucide-react";
import type { PostType } from "@/lib/posts";

export const typeMeta: Record<PostType, { label: string; Icon: LucideIcon; color: string }> = {
  achievement: { label: "Achievement", Icon: Trophy, color: "#f59e0b" },
  struggle: { label: "Struggle", Icon: Mountain, color: "#3b82f6" },
  dream: { label: "Dream", Icon: Sparkles, color: "#8b5cf6" },
  vibe: { label: "Vibe", Icon: Flame, color: "#ec4899" },
};