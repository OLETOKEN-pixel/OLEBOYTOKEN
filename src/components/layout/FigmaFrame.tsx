import type { CSSProperties, ReactNode } from "react";
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

  const outerStyle: CSSProperties = {
    width: `${baseWidth * scale}px`,
    height: baseHeight ? `${baseHeight * scale}px` : undefined,
    margin: "0 auto",
    position: "relative",
    ...style,
  };

  const composedInnerStyle: CSSProperties = {
    width: `${baseWidth}px`,
    height: baseHeight ? `${baseHeight}px` : undefined,
    transform: `scale(${scale})`,
    transformOrigin: origin,
    position: "absolute",
    top: 0,
    left: 0,
    ...innerStyle,
  };

  return (
    <div className={className} style={outerStyle}>
      <div className={innerClassName} style={composedInnerStyle}>
        {children}
      </div>
    </div>
  );
}

export default FigmaFrame;
