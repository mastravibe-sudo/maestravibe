// path: maestra-vibe/components/postMeta.ts  (NEW file)
import { Flame, Mountain, Sparkles, Trophy, type LucideIcon } from "lucide-react";
import type { PostType } from "@/lib/posts";

export const typeMeta: Record<PostType, { label: string; Icon: LucideIcon }> = {
  achievement: { label: "Achievement", Icon: Trophy },
  struggle: { label: "Struggle", Icon: Mountain },
  dream: { label: "Dream", Icon: Sparkles },
  vibe: { label: "Vibe", Icon: Flame },
};