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
  const [disabled, setDisabled] = useState(true);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const userAgent = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(userAgent)
      || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const device = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean; effectiveType?: string };
    };
    const lowPower = (device.deviceMemory !== undefined && device.deviceMemory <= 2)
      || navigator.hardwareConcurrency <= 2
      || device.connection?.saveData === true
      || device.connection?.effectiveType === "2g";
    const update = () => {
      const shouldDisable = isIOS || lowPower || motion.matches;
      setDisabled(shouldDisable);
      setReducedMotion(motion.matches);
      setPaused(document.visibilityState !== "visible" || shouldDisable);
    };
    update();
    motion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      motion.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  if (disabled) return null;

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
