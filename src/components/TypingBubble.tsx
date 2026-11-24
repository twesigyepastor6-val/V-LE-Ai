import { useEffect, useRef } from "react";

const IDLE_RGB = [71, 85, 105];   // #475569
const ACTIVE_RGB = [226, 232, 240]; // #e2e8f0

function mixRgb(progress: number): string {
  const r = Math.round(IDLE_RGB[0] + (ACTIVE_RGB[0] - IDLE_RGB[0]) * progress);
  const g = Math.round(IDLE_RGB[1] + (ACTIVE_RGB[1] - IDLE_RGB[1]) * progress);
  const b = Math.round(IDLE_RGB[2] + (ACTIVE_RGB[2] - IDLE_RGB[2]) * progress);
  return `rgb(${r}, ${g}, ${b})`;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Recreates the exact 40-frame @ 30fps Lottie-inspired three-dot animation
 * from Animated_App_2eef2afc.txt: each dot swells (1.0x -> 1.5x) and brightens
 * (#475569 -> #e2e8f0) in turn with smooth ease-in-out curves.
 */
export function TypingBubble() {
  const dotRefs = useRef<Array<HTMLSpanElement | null>>([null, null, null]);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      return;
    }

    let rafId = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsedSec = (now - start) / 1000;
      const frame = (elapsedSec * 30) % 40;

      for (let i = 0; i < 3; i++) {
        const el = dotRefs.current[i];
        if (!el) continue;

        const phase = (((frame - 10 * i) % 40) + 40) % 40;
        let e = 0;
        if (phase < 10) {
          e = smooth(phase / 10);
        } else if (phase < 20) {
          e = 1 - smooth((phase - 10) / 10);
        }

        const scale = 1 + 0.5 * e;
        el.style.transform = `scale(${scale.toFixed(3)})`;
        el.style.backgroundColor = mixRgb(e);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);
  return (
    <div
      className="flex items-start gap-3"
      aria-label="V∆LE Ai is typing"
      role="status"
    >
      <div className="bg-[#1e293b] border border-white/[0.06] rounded-2xl rounded-tl-md px-5 py-4 flex items-center gap-3 min-h-[48px]">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            ref={(el) => {
              dotRefs.current[index] = el;
            }}
            className="w-2.5 h-2.5 rounded-full bg-[#475569] inline-block will-change-transform"
          />
        ))}
      </div>
    </div>
  );
}
