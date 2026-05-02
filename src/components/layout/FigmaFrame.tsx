import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useFigmaScale, FIGMA_DEFAULT_BASE_WIDTH } from "@/hooks/useFigmaScale";

type FigmaFrameProps = {
  baseWidth?: number;
  baseHeight?: number;
  origin?: CSSProperties["transformOrigin"];
  className?: string;
  innerClassName?: string;
  style?: CSSProperties;
  innerStyle?: CSSProperties;
  children: ReactNode;
};

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function FigmaFrame({
  baseWidth = FIGMA_DEFAULT_BASE_WIDTH,
  baseHeight,
  origin = "top left",
  className,
  innerClassName,
  style,
  innerStyle,
  children,
}: FigmaFrameProps) {
  const scale = useFigmaScale(baseWidth);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);

  // When baseHeight is not provided, measure the inner content so the outer box
  // collapses to the right scaled height (otherwise position: absolute inner ⇒ outer height 0).
  useIsomorphicLayoutEffect(() => {
    if (baseHeight) return;
    const node = innerRef.current;
    if (!node) return;

    const update = () => {
      setMeasuredHeight(node.scrollHeight);
    };
    update();

    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, [baseHeight, children]);

  const innerHeightPx = baseHeight ?? measuredHeight ?? 0;
  const outerHeight = baseHeight
    ? `${baseHeight * scale}px`
    : measuredHeight !== null
    ? `${measuredHeight * scale}px`
    : undefined;

  const outerStyle: CSSProperties = {
    width: `${baseWidth * scale}px`,
    height: outerHeight,
    margin: "0 auto",
    position: "relative",
    ...style,
  };

  const composedInnerStyle: CSSProperties = {
    width: `${baseWidth}px`,
    height: baseHeight ? `${baseHeight}px` : undefined,
    minHeight: baseHeight ? undefined : `${innerHeightPx}px`,
    transform: `scale(${scale})`,
    transformOrigin: origin,
    position: "absolute",
    top: 0,
    left: 0,
    ...innerStyle,
  };

  return (
    <div className={className} style={outerStyle}>
      <div ref={innerRef} className={innerClassName} style={composedInnerStyle}>
        {children}
      </div>
    </div>
  );
}

export default FigmaFrame;
