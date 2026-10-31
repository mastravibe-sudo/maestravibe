// path: maestra-vibe/lib/useOverlayHistory.ts  (NEW file)
// Popup / viewer khulne par browser history mein ek step jorta hai, taake Back dabane par sirf wohi popup band ho.
import { useEffect, useRef } from "react";

export function useOverlayHistory(onClose: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    let pushed = false;
    let popped = false;
    const marker = Date.now() + Math.random();
    const timer = window.setTimeout(() => {
      window.history.pushState({ overlay: marker }, "");
      pushed = true;
    }, 0);
    const onPop = () => {
      popped = true;
      closeRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("popstate", onPop);
      // X button se band hua to apna joda hua step wapas hata do
      if (pushed && !popped && (window.history.state as { overlay?: number } | null)?.overlay === marker) window.history.back();
    };
  }, []);
}