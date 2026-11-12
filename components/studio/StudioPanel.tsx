"use client";

import { useId, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

const RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70";

export function SubTabs({
  items,
  value,
  onChange,
  label,
}: {
  items: ReadonlyArray<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-white/10 px-3 py-2 [scrollbar-width:none]">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
          className={"min-h-10 shrink-0 rounded-full px-4 text-xs font-semibold transition motion-reduce:transition-none " + RING + " " + (value === item.id ? "bg-violet-500/25 text-white ring-1 ring-violet-300/40" : "text-zinc-400 hover:bg-white/5 hover:text-white")}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function Disclosure({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="shrink-0 border-t border-white/10 bg-[#0b0820]/95">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle} className={"flex min-h-12 w-full items-center justify-between gap-3 px-4 text-sm font-semibold text-zinc-200 hover:bg-white/5 " + RING}>
        <span className="inline-flex items-center gap-2 text-violet-200">{icon}{title}</span>
        <ChevronDown className={"h-4 w-4 transition-transform motion-reduce:transition-none " + (open ? "rotate-180" : "")} />
      </button>
      <div id={id} hidden={!open} className="max-h-[42dvh] space-y-3 overflow-y-auto overscroll-contain px-4 pb-4 pt-1">
        {children}
      </div>
    </div>
  );
}
