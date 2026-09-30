// path: maestra-vibe/lib/store.tsx  (NAYI file)
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { profiles } from "./profiles";
import { initialPosts, type Post, type PostType } from "./posts";

export const ME = "ali"; // demo user. Login ke baad asli user hoga.

export type Comment = { id: string; postId: string; username: string; text: string; pinned: boolean };
export type Note = { id: string; text: string; read: boolean };
type State = {
  posts: Post[];
  comments: Comment[];
  following: string[];
  blocked: string[];
  saved: string[];
  reports: { postId: string; reason: string }[];
  closed: string[]; // jin posts par comments band hain
  notes: Note[];
  onboarded: boolean;
};

const init: State = {
  posts: initialPosts,
  comments: [{ id: "c1", postId: "p1", username: "sara", text: "Congratulations, Bilal! 🎉", pinned: false }],
  following: [],
  blocked: [],
  saved: [],
  reports: [],
  closed: [],
  notes: [
    { id: "n1", text: "Sara gave your post a 🔥 Vibe", read: false },
    { id: "n2", text: "Bilal 🤝 supported your struggle", read: false },
  ],
  onboarded: false,
};

const uid = () => Math.random().toString(36).slice(2, 9);
const toggle = (a: string[], v: string) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);

function useStoreValue() {
  const [s, setS] = useState<State>(init);

  useEffect(() => {
    try {
      const v = localStorage.getItem("mv-state");
      if (v) setS(JSON.parse(v));
    } catch {}
  }, []);

  const up = (fn: (x: State) => State) =>
    setS((prev) => {
      const n = fn(prev);
      try {
        localStorage.setItem("mv-state", JSON.stringify(n));
      } catch {}
      return n;
    });

  return {
    s,
    addPost: (type: PostType, text: string, image?: string, extra: Partial<Post> = {}) =>
      up((x) => ({
        ...x,
        posts: [{ id: uid(), username: ME, type, text, time: "now", vibes: 0, vibed: [], image, ...extra }, ...x.posts],
      })),
    vibe: (id: string) =>
      up((x) => ({ ...x, posts: x.posts.map((p) => (p.id === id ? { ...p, vibed: toggle(p.vibed, ME) } : p)) })),
    save: (id: string) => up((x) => ({ ...x, saved: toggle(x.saved, id) })),
    follow: (u: string) => up((x) => ({ ...x, following: toggle(x.following, u) })),
    followMany: (us: string[]) =>
      up((x) => ({ ...x, following: Array.from(new Set([...x.following, ...us])), onboarded: true })),
    skip: () => up((x) => ({ ...x, onboarded: true })),
    block: (u: string) =>
      up((x) => ({ ...x, blocked: [...x.blocked, u], following: x.following.filter((f) => f !== u) })),
    report: (postId: string, reason: string) =>
      up((x) => ({ ...x, reports: [...x.reports, { postId, reason }] })),
    comment: (postId: string, text: string) =>
      up((x) => ({ ...x, comments: [...x.comments, { id: uid(), postId, username: ME, text, pinned: false }] })),
    pin: (id: string) =>
      up((x) => ({ ...x, comments: x.comments.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)) })),
    toggleComments: (postId: string) => up((x) => ({ ...x, closed: toggle(x.closed, postId) })),
    readAll: () => up((x) => ({ ...x, notes: x.notes.map((n) => ({ ...n, read: true })) })),
    // "Mera bhi yehi khwab": dusre ka dream apni profile ki Dreams list mein jorta hai
    adoptDream: (text: string) => {
      try {
        const key = "mv-profile-" + ME;
        const saved = localStorage.getItem(key);
        const prof = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(profiles.find((p) => p.username === ME)));
        let b = prof.blocks.find((k: { kind: string }) => k.kind === "checklist");
        if (!b) {
          b = { id: uid(), kind: "checklist", icon: "🌠", title: "My Dreams", items: [] };
          prof.blocks.push(b);
        }
        b.items.push({ text, done: false });
        localStorage.setItem(key, JSON.stringify(prof));
        window.dispatchEvent(new Event("mv-profile"));
      } catch {}
    },
  };
}

type Store = ReturnType<typeof useStoreValue>;
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  return <Ctx.Provider value={useStoreValue()}>{children}</Ctx.Provider>;
}
export const useStore = () => useContext(Ctx)!;