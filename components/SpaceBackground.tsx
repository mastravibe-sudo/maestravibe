"use client";

import { useEffect, useState } from "react";

const stars = Array.from({ length: 42 }, (_, index) => ({
  left: (index * 37 + 11) % 100,
  top: (index * 61 + 7) % 100,
  size: index % 9 === 0 ? 3 : index % 3 === 0 ? 2 : 1,
  depth: 20 + (index * 19) % 130,
  delay: -((index * 7) % 24),
  opacity: 0.2 + ((index * 13) % 45) / 100,
}));

export default function SpaceBackground() {
  const [paused, setPaused] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReducedMotion(motion.matches);
      setPaused(document.visibilityState !== "visible" || motion.matches);
    };
    update();
    motion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      motion.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden opacity-45">
      <div className="space-depth-field">
        {stars.map((star, index) => (
          <span
            key={index}
            className="space-star"
            data-paused={paused}
            data-reduced-motion={reducedMotion}
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: star.size,
              height: star.size,
              opacity: star.opacity,
              animationDelay: `${star.delay}s`,
              "--star-depth": `${star.depth}px`,
            } as React.CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}
