"use client";

import { useEffect, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import type { CSSProperties, ReactNode } from "react";
import type { ProfileBlock, ProfileRecord } from "@/lib/profile-schema";

export type BlockGeometry = { x: number; y: number; width: number; height: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function getBlockGeometry(block: ProfileBlock, index: number): BlockGeometry {
  const style = block.style ?? {};
  const defaults: BlockGeometry = (() => {
    switch (block.type) {
      case "header": return { x: 5, y: 4, width: 90, height: 16 };
      case "stats": return { x: 5, y: 22, width: 90, height: 12 };
      case "about": return { x: 5, y: 38, width: 52, height: 22 };
      case "links": return { x: 61, y: 38, width: 34, height: 22 };
      case "gallery": return { x: 5, y: 64, width: 90, height: 20 };
      case "posts": return { x: 5, y: 87, width: 90, height: 11 };
      case "divider": return { x: 5, y: 52 + (index % 3) * 8, width: 90, height: 5 };
      case "spacer": return { x: 5, y: 52 + (index % 3) * 8, width: 90, height: 8 };
      default: return { x: 5, y: 43 + (index % 3) * 11, width: 42, height: 18 };
    }
  })();

  const x = clamp(isNumber(style.x) ? style.x : defaults.x, 0, 95);
  const y = clamp(isNumber(style.y) ? style.y : defaults.y, 0, 96);
  return {
    x,
    y,
    width: clamp(isNumber(style.width) ? style.width : defaults.width, 5, 100 - x),
    height: clamp(isNumber(style.height) ? style.height : defaults.height, 4, 100 - y),
  };
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function safeHref(value: unknown) {
  if (typeof value !== "string") return "#";
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? value : "#";
  } catch {
    return "#";
  }
}

function BlockContent({
  block,
  profile,
  stats,
  action,
}: {
  block: ProfileBlock;
  profile: ProfileRecord;
  stats: { followers: number; following: number };
  action?: ReactNode;
}) {
  const config = block.config ?? {};
  const style = block.style ?? {};
  const title = asString(config.title, block.type === "about" ? "About" : block.type === "links" ? "Links" : "Your section");
  const body = asString(config.body, block.type === "about" ? profile.bio : "Add your text in the inspector.");
  const buttonStyle = asString(style.buttonStyle, profile.theme.buttonStyle);
  const links = Array.isArray(config.links) ? config.links.filter((item): item is { text?: string; href?: string } => !!item && typeof item === "object") : [];
  const images = Array.isArray(config.images) ? config.images.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
  const shellStyle: CSSProperties = {
    backgroundColor: asString(style.backgroundColor, "rgba(255,255,255,0.08)"),
    color: asString(style.textColor, profile.theme.text),
    fontFamily: asString(style.fontFamily, profile.theme.fontBody),
    fontSize: `${clamp(isNumber(style.fontSize) ? style.fontSize : 16, 10, 52)}px`,
    textAlign: ["left", "center", "right"].includes(asString(style.textAlign, "left"))
      ? (asString(style.textAlign, "left") as CSSProperties["textAlign"])
      : "left",
    borderRadius: `${clamp(isNumber(style.borderRadius) ? style.borderRadius : 18, 0, 48)}px`,
  };

  if (block.type === "divider") {
    return <div aria-hidden="true" className="h-full w-full border-t" style={{ borderColor: asString(style.backgroundColor, profile.theme.border) }} />;
  }
  if (block.type === "spacer") return null;

  return (
    <div className="h-full w-full overflow-auto border border-white/10 p-4 shadow-lg backdrop-blur-sm" style={shellStyle}>
      {block.type === "header" ? (
        <div className="flex h-full items-center gap-4">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" className="h-16 w-16 shrink-0 rounded-full border-2 border-white/20 object-cover" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-violet-600 text-2xl font-semibold text-white">
              {(profile.name || profile.username).slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-bold" style={{ fontFamily: profile.theme.fontHeading, fontSize: "1.55em" }}>
              {profile.name || profile.username}
            </h1>
            <p className="truncate opacity-70">@{profile.username}</p>
          </div>
          {action}
        </div>
      ) : null}

      {block.type === "stats" ? (
        <div className="grid h-full grid-cols-2 gap-2 sm:grid-cols-4">
          {[{ name: "Followers", value: stats.followers }, { name: "Following", value: stats.following }, { name: "Vibes", value: 0 }, { name: "Posts", value: 0 }].map((item) => (
            <div key={item.name} className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-black/10 px-2 text-center">
              <span className="text-xl font-bold">{item.value}</span>
              <span className="text-[0.72em] uppercase opacity-65">{item.name}</span>
            </div>
          ))}
        </div>
      ) : null}

      {block.type === "about" || block.type === "text" ? (
        <div>
          <h2 className="mb-2 font-semibold" style={{ fontFamily: profile.theme.fontHeading }}>{title}</h2>
          <p className="whitespace-pre-wrap leading-relaxed">{block.type === "about" ? profile.bio || "Add a bio in your profile settings." : body}</p>
        </div>
      ) : null}

      {block.type === "quote" ? (
        <blockquote className="flex h-full flex-col justify-center">
          <p className="font-serif text-[1.25em] italic leading-relaxed">“{body}”</p>
          {config.author ? <cite className="mt-3 not-italic opacity-65">{String(config.author)}</cite> : null}
        </blockquote>
      ) : null}

      {block.type === "links" ? (
        <div>
          <h2 className="mb-3 font-semibold" style={{ fontFamily: profile.theme.fontHeading }}>{title}</h2>
          <div className="flex flex-wrap gap-2">
            {links.map((link, index) => (
              <a
                key={`${link.href ?? index}-${index}`}
                href={safeHref(link.href)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-2 text-sm font-medium transition hover:brightness-110"
                style={{
                  borderRadius: `${clamp(isNumber(style.borderRadius) ? style.borderRadius : 999, 0, 999)}px`,
                  color: buttonStyle === "filled" ? profile.theme.buttonText : asString(style.textColor, profile.theme.accent),
                  background: buttonStyle === "filled" ? asString(style.backgroundColor, profile.theme.accent) : "transparent",
                  border: buttonStyle === "ghost" ? "1px solid transparent" : `1px solid ${asString(style.backgroundColor, profile.theme.accent)}`,
                }}
              >
                {link.text || "Link"}
              </a>
            ))}
            {!links.length ? <span className="text-sm opacity-60">Add links in the inspector.</span> : null}
          </div>
        </div>
      ) : null}

      {block.type === "gallery" ? (
        <div className="h-full">
          <h2 className="mb-2 font-semibold" style={{ fontFamily: profile.theme.fontHeading }}>{title}</h2>
          <div className="grid h-[calc(100%-2rem)] grid-cols-2 gap-2 sm:grid-cols-3">
            {images.map((image, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={`${image}-${index}`} src={image} alt="Gallery item" className="h-full min-h-16 w-full rounded-lg object-cover" />
            ))}
            {!images.length ? <span className="text-sm opacity-60">Add image URLs in the inspector.</span> : null}
          </div>
        </div>
      ) : null}

      {block.type === "posts" ? (
        <div>
          <h2 className="font-semibold" style={{ fontFamily: profile.theme.fontHeading }}>{title === "Your section" ? "Recent posts" : title}</h2>
          <p className="mt-2 text-sm opacity-65">Posts from @{profile.username}</p>
        </div>
      ) : null}

      {!(["header", "stats", "about", "text", "quote", "links", "gallery", "posts", "divider", "spacer"] as string[]).includes(block.type) ? (
        <div>
          <h2 className="font-semibold" style={{ fontFamily: profile.theme.fontHeading }}>{title}</h2>
          <p className="mt-2 whitespace-pre-wrap">{body}</p>
        </div>
      ) : null}
    </div>
  );
}

export default function ProfileCanvas({
  profile,
  blocks,
  stats,
  editable = false,
  selectedBlockId,
  onSelectBlock,
  onGeometryChange,
  action,
}: {
  profile: ProfileRecord;
  blocks: ProfileBlock[];
  stats: { followers: number; following: number };
  editable?: boolean;
  selectedBlockId?: string | null;
  onSelectBlock?: (id: string) => void;
  onGeometryChange?: (id: string, geometry: BlockGeometry) => void;
  action?: ReactNode;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 960 });

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const measure = () => setStageSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const background = profile.banner_url
    ? `linear-gradient(rgba(8, 10, 20, 0.52), rgba(8, 10, 20, 0.7)), url("${profile.banner_url}")`
    : profile.theme.backgroundType === "gradient"
      ? profile.theme.backgroundValue
      : profile.theme.page;

  return (
    <div
      ref={stageRef}
      className={`profile-canvas-stage relative isolate mx-auto w-full overflow-hidden border border-white/15 ${editable ? "rounded-xl" : "rounded-[28px] shadow-2xl"}`}
      style={{
        background,
        backgroundSize: "cover",
        backgroundPosition: "center",
        color: profile.theme.text,
        fontFamily: profile.theme.fontBody,
      }}
    >
      {editable ? <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(to right, rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.08) 1px, transparent 1px)", backgroundSize: "5% 5%" }} /> : null}
      {blocks.map((block, index) => {
        const geometry = getBlockGeometry(block, index);
        if (block.style?.hidden === true && !editable) return null;
        const selected = block.id === selectedBlockId;
        const content = <BlockContent block={block} profile={profile} stats={stats} action={block.type === "header" ? action : undefined} />;

        if (!editable) {
          return (
            <div
              key={block.id}
              className="absolute"
              style={{ left: `${geometry.x}%`, top: `${geometry.y}%`, width: `${geometry.width}%`, height: `${geometry.height}%` }}
            >
              {content}
            </div>
          );
        }

        return (
          <Rnd
            key={block.id}
            bounds="parent"
            position={{ x: (geometry.x / 100) * stageSize.width, y: (geometry.y / 100) * stageSize.height }}
            size={{ width: (geometry.width / 100) * stageSize.width, height: (geometry.height / 100) * stageSize.height }}
            minWidth={100}
            minHeight={52}
            dragHandleClassName="profile-block-handle"
            enableResizing={selected}
            resizeHandleStyles={{
              bottomRight: { width: 14, height: 14, right: -5, bottom: -5, borderRadius: 4, background: "#c4b5fd", border: "2px solid #18181b" },
            }}
            className={selected ? "group z-20 ring-2 ring-violet-300" : "group z-10 hover:ring-1 hover:ring-white/50"}
            onMouseDown={() => onSelectBlock?.(block.id)}
            onDragStop={(_event, data) => onGeometryChange?.(block.id, {
              ...geometry,
              x: clamp((data.x / stageSize.width) * 100, 0, 100 - geometry.width),
              y: clamp((data.y / stageSize.height) * 100, 0, 100 - geometry.height),
            })}
            onResizeStop={(_event, _direction, element, _delta, position) => onGeometryChange?.(block.id, {
              x: clamp((position.x / stageSize.width) * 100, 0, 95),
              y: clamp((position.y / stageSize.height) * 100, 0, 96),
              width: clamp((element.offsetWidth / stageSize.width) * 100, 5, 100 - (position.x / stageSize.width) * 100),
              height: clamp((element.offsetHeight / stageSize.height) * 100, 4, 100 - (position.y / stageSize.height) * 100),
            })}
          >
            <div className="h-full w-full">
              <div className={`profile-block-handle absolute -top-6 left-0 cursor-move rounded-t bg-zinc-950/90 px-2 py-1 text-[10px] font-semibold uppercase text-violet-200 transition ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                {block.type} · drag
              </div>
              {content}
            </div>
          </Rnd>
        );
      })}
    </div>
  );
}