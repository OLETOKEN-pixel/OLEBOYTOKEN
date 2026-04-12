import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const DESKTOP_BREAKPOINT = 1024;

function getIsMobile() {
  return typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false;
}

function getIsDesktop() {
  return typeof window !== "undefined" ? window.innerWidth >= DESKTOP_BREAKPOINT : false;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(getIsMobile);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(getIsMobile());
    };
    mql.addEventListener("change", onChange);
    setIsMobile(getIsMobile());
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = React.useState<boolean>(getIsDesktop);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mql = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    const onChange = () => {
      setIsDesktop(getIsDesktop());
    };
    mql.addEventListener("change", onChange);
    setIsDesktop(getIsDesktop());
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}
