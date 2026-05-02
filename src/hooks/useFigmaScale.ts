import { useEffect, useState } from "react";

const FIGMA_BASE_WIDTH = 1920;
const MIN_SCALE_VW = 768;

function computeScale(baseWidth: number): number {
  if (typeof window === "undefined") return 1;
  const w = Math.max(MIN_SCALE_VW, window.innerWidth);
  return Math.min(1, w / baseWidth);
}

export function useFigmaScale(baseWidth: number = FIGMA_BASE_WIDTH): number {
  const [scale, setScale] = useState(() => computeScale(baseWidth));

  useEffect(() => {
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setScale(computeScale(baseWidth));
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      cancelAnimationFrame(raf);
    };
  }, [baseWidth]);

  return scale;
}

export const FIGMA_SCALE_MIN_VW = MIN_SCALE_VW;
export const FIGMA_DEFAULT_BASE_WIDTH = FIGMA_BASE_WIDTH;
