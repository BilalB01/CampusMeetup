import { useEffect, useRef, useState } from "react";

// Telt op van 0 naar target via requestAnimationFrame. Springt meteen naar
// de eindwaarde bij prefers-reduced-motion (CSS kan een JS-lus niet
// uitschakelen, dus hier apart gecheckt — zie ook index.css)
export function useCountUp(target, duration = 600) {
  const [value, setValue] = useState(0);
  const startRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    startRef.current = null;
    let frame;
    function tick(timestamp) {
      if (startRef.current === null) startRef.current = timestamp;
      const progress = Math.min(1, (timestamp - startRef.current) / duration);
      setValue(Math.round(progress * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
