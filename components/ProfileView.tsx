"use client";

import { useEffect, useState } from "react";
import {
  fonts,
  presets,
  readable,
  rgba,
  type Block,
  type BlockKind,
  type Item,
  type Profile,
  type Style,
} from "@/lib/profiles";

const uid = () => Math.random().toString(36).slice(2, 9);

const templates: Record<BlockKind, () => Block> = {
  text: () => ({ id: uid(), kind: "text", icon: "📝", title: "Naya Section", text: "Yahan apne baare mein likho..." }),
  list: () => ({ id: uid(), kind: "list", icon: "⭐", title: "Meri List", items: [{ text: "Pehli cheez" }] }),
  checklist: () => ({ id: uid(), kind: "checklist", icon: "🌠", title: "Dreams", items: [{ text: "Pehla khwab", done: false }] }),
  achievements: () => ({ id: uid(), kind: "achievements", icon: "🏆", title: "Achievements", items: [{ text: "Meri kamyabi", status: "self" }] }),
};

const statusLabel = {
  self: "Self-declared",
  proof: "Proof uploaded",
  verified: "Verified ✓",
};

const colorFields = [
  ["bg1", "Background 1"],
  ["bg2", "Background 2"],
  ["card", "Card"],
  ["text", "Text"],
  ["accent", "Accent"],
] as const;

export default function ProfileView({ initial }: { initial: Profile }) {
  const key = `mv-profile-${initial.username}`;
  const [p, setP] = useState<Profile>(initial);
  const [edit, setEdit] = useState(false);
  const s = p.style;

  // Pehle se save ki hui tabdeeliyan load karo
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) setP(JSON.parse(saved));
    } catch {}
  }, [key]);

  const save = (next: Profile) => {
    setP(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  };
  const reset = () => {
    try {
      localStorage.removeItem(key);
    } catch {}
    setP(initial);
  };

  const setStyle = (patch: Partial<Style>) => save({ ...p, style: { ...s, ...patch } });
  const setBlock = (id: string, patch: Partial<Block>) =>
    save({ ...p, blocks: p.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  const removeBlock = (id: string) => save({ ...p, blocks: p.blocks.filter((b) => b.id !== id) });
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= p.blocks.length) return;
    const arr = [...p.blocks];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    save({ ...p, blocks: arr });
  };
  const setItem = (b: Block, i: number, patch: Partial<Item>) =>
    setBlock(b.id, { items: (b.items ?? []).map((it, k) => (k === i ? { ...it, ...patch } : it)) });
  const addItem = (b: Block) =>
    setBlock(b.id, {
      items: [
        ...(b.items ?? []),
        b.kind === "achievements" ? { text: "", status: "self" } : b.kind === "checklist" ? { text: "", done: false } : { text: "" },
      ],
    });
  const delItem = (b: Block, i: number) =>
    setBlock(b.id, { items: (b.items ?? []).filter((_, k) => k !== i) });

  const inputStyle = {
    background: rgba(s.text, 0.08),
    border: `1px solid ${rgba(s.text, 0.25)}`,
    color: s.text,
  };
  const accentBtn = { background: s.accent, color: readable(s.accent) };

  return (
    <div
      className="min-h-screen"
      style={{
        background: `linear-gradient(135deg, ${s.bg1}, ${s.bg2})`,
        color: s.text,
        fontFamily: fonts[s.font],
      }}
    >
      {/* Toolbar */}
      <div
        className="sticky top-0 z-30 border-b border-white/10 bg-zinc-950/95 p-3 text-zinc-100 backdrop-blur"
        style={{ fontFamily: fonts.sans }}
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2">
          <span className="text-sm text-zinc-400">@{p.username}</span>
          <div className="flex gap-2">
            {edit && (
              <button onClick={reset} className="rounded-full bg-zinc-800 px-3 py-1.5 text-sm">
                ↺ Reset
              </button>
            )}
            <button
              onClick={() => setEdit(!edit)}
              className="rounded-full bg-violet-500 px-4 py-1.5 text-sm font-medium text-white"
            >
              {edit ? "✅ Done" : "✏️ Edit profile"}
            </button>
          </div>
        </div>

        {edit && (
          <div className="mx-auto mt-3 max-w-2xl space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 text-zinc-400">Presets</span>
              {Object.keys(presets).map((name) => (
                <button
                  key={name}
                  onClick={() => setStyle(presets[name])}
                  className="rounded-full bg-zinc-800 px-3 py-1 hover:bg-zinc-700"
                >
                  {name}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="w-16 text-zinc-400">Colours</span>
              {colorFields.map(([k, label]) => (
                <label key={k} className="flex items-center gap-1 text-xs text-zinc-300">
                  <input
                    type="color"
                    value={s[k]}
                    onChange={(e) => setStyle({ [k]: e.target.value } as Partial<Style>)}
                    className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent"
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="text-xs text-zinc-400">
                Card opacity
                <input type="range" min={0.1} max={1} step={0.05} value={s.cardAlpha}
                  onChange={(e) => setStyle({ cardAlpha: +e.target.value })} className="w-full" />
              </label>
              <label className="text-xs text-zinc-400">
                Roundness
                <input type="range" min={0} max={40} value={s.radius}
                  onChange={(e) => setStyle({ radius: +e.target.value })} className="w-full" />
              </label>
              <label className="text-xs text-zinc-400">
                Avatar size
                <input type="range" min={60} max={200} value={p.avatarSize}
                  onChange={(e) => save({ ...p, avatarSize: +e.target.value })} className="w-full" />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 text-zinc-400">Font</span>
              {(Object.keys(fonts) as Style["font"][]).map((f) => (
                <button
                  key={f}
                  onClick={() => setStyle({ font: f })}
                  className={`rounded-full px-3 py-1 ${s.font === f ? "bg-violet-500 text-white" : "bg-zinc-800"}`}
                  style={{ fontFamily: fonts[f] }}
                >
                  {f}
                </button>
              ))}
              <span className="ml-3 text-zinc-400">Align</span>
              {(["center", "left"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => save({ ...p, align: a })}
                  className={`rounded-full px-3 py-1 ${p.align === a ? "bg-violet-500 text-white" : "bg-zinc-800"}`}
                >
                  {a}
                </button>
              ))}
              <span className="ml-3 text-zinc-400">Avatar</span>
              <input
                value={p.avatar}
                maxLength={4}
                onChange={(e) => save({ ...p, avatar: e.target.value })}
                className="w-16 rounded-lg bg-zinc-800 px-2 py-1 text-center text-lg outline-none"
              />
            </div>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-2xl px-4 py-10">
        {/* Header */}
        <div
          className={`mb-8 flex flex-col gap-3 ${
            p.align === "center" ? "items-center text-center" : "items-start text-left"
          }`}
        >
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: p.avatarSize,
              height: p.avatarSize,
              fontSize: p.avatarSize / 2,
              ...accentBtn,
            }}
          >
            {p.avatar}
          </div>
          {edit ? (
            <>
              <input
                value={p.name}
                onChange={(e) => save({ ...p, name: e.target.value })}
                className="w-full rounded-lg px-3 py-2 text-2xl font-bold outline-none"
                style={inputStyle}
              />
              <input
                value={p.tagline}
                onChange={(e) => save({ ...p, tagline: e.target.value })}
                className="w-full rounded-lg px-3 py-2 outline-none"
                style={inputStyle}
              />
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold">{p.name}</h1>
              <p style={{ opacity: 0.75 }}>{p.tagline}</p>
            </>
          )}
        </div>

        {/* Blocks */}
        <div className="space-y-4">
          {p.blocks.map((b, i) => (
            <section
              key={b.id}
              className="p-5"
              style={{
                background: rgba(s.card, s.cardAlpha),
                borderRadius: s.radius,
                border: `1px solid ${rgba(s.text, 0.12)}`,
              }}
            >
              {/* Block title row */}
              <div className="mb-3 flex items-center gap-2">
                {edit ? (
                  <>
                    <input
                      value={b.icon}
                      maxLength={4}
                      onChange={(e) => setBlock(b.id, { icon: e.target.value })}
                      className="w-14 rounded-lg px-2 py-1 text-center text-lg outline-none"
                      style={inputStyle}
                    />
                    <input
                      value={b.title}
                      onChange={(e) => setBlock(b.id, { title: e.target.value })}
                      className="min-w-0 flex-1 rounded-lg px-3 py-1.5 text-lg font-semibold outline-none"
                      style={inputStyle}
                    />
                    <button onClick={() => move(i, -1)} className="px-1">↑</button>
                    <button onClick={() => move(i, 1)} className="px-1">↓</button>
                    <button onClick={() => removeBlock(b.id)} className="px-1">🗑</button>
                  </>
                ) : (
                  <h2 className="text-lg font-semibold">
                    {b.icon} {b.title}
                  </h2>
                )}
              </div>

              {/* Block content: edit mode */}
              {edit && b.kind === "text" && (
                <textarea
                  value={b.text ?? ""}
                  rows={4}
                  onChange={(e) => setBlock(b.id, { text: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 outline-none"
                  style={inputStyle}
                />
              )}
              {edit && b.kind !== "text" && (
                <div className="space-y-2">
                  {(b.items ?? []).map((it, k) => (
                    <div key={k} className="flex items-center gap-2">
                      {b.kind === "checklist" && (
                        <input
                          type="checkbox"
                          checked={!!it.done}
                          onChange={(e) => setItem(b, k, { done: e.target.checked })}
                        />
                      )}
                      {b.kind === "achievements" && (
                        <button
                          onClick={() =>
                            it.status !== "verified" &&
                            setItem(b, k, { status: it.status === "proof" ? "self" : "proof" })
                          }
                          className="shrink-0 rounded-full px-2 py-1 text-xs"
                          style={{ background: rgba(s.accent, 0.3) }}
                        >
                          {statusLabel[it.status ?? "self"]}
                        </button>
                      )}
                      <input
                        value={it.text}
                        onChange={(e) => setItem(b, k, { text: e.target.value })}
                        className="min-w-0 flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                        style={inputStyle}
                      />
                      <button onClick={() => delItem(b, k)}>✕</button>
                    </div>
                  ))}
                  <button
                    onClick={() => addItem(b)}
                    className="rounded-full px-3 py-1 text-sm"
                    style={accentBtn}
                  >
                    + Add
                  </button>
                </div>
              )}

              {/* Block content: view mode */}
              {!edit && b.kind === "text" && (
                <p className="whitespace-pre-wrap leading-relaxed">{b.text}</p>
              )}
              {!edit && b.kind === "list" && (
                <div className="flex flex-wrap gap-2">
                  {(b.items ?? []).map((it, k) => (
                    <span
                      key={k}
                      className="rounded-full px-3 py-1 text-sm"
                      style={{ background: rgba(s.accent, 0.22) }}
                    >
                      {it.text}
                    </span>
                  ))}
                </div>
              )}
              {!edit && b.kind === "checklist" && (
                <div>
                  <p className="mb-2 text-sm" style={{ opacity: 0.7 }}>
                    {(b.items ?? []).filter((d) => d.done).length} of {(b.items ?? []).length} poore hue
                  </p>
                  <ul className="space-y-1">
                    {(b.items ?? []).map((it, k) => (
                      <li key={k}>
                        {it.done ? "✅" : "⬜"} {it.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!edit && b.kind === "achievements" && (
                <ul className="space-y-2">
                  {(b.items ?? []).map((it, k) => (
                    <li key={k} className="flex items-center justify-between gap-3">
                      <span>🏆 {it.text}</span>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-xs"
                        style={{ background: rgba(s.accent, 0.25) }}
                      >
                        {statusLabel[it.status ?? "self"]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {/* Add block */}
        {edit && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="text-sm" style={{ opacity: 0.7 }}>Naya section:</span>
            {(
              [
                ["text", "+ Text"],
                ["list", "+ List"],
                ["checklist", "+ Checklist"],
                ["achievements", "+ Achievements"],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                onClick={() => save({ ...p, blocks: [...p.blocks, templates[kind]()] })}
                className="rounded-full px-3 py-1.5 text-sm"
                style={accentBtn}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}