import * as React from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedCounterProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "prefix"> {
  value: number;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  formatOptions?: Intl.NumberFormatOptions;
  locale?: string;
  decimals?: number;
  duration?: number;
}

export const AnimatedCounter = React.forwardRef<HTMLSpanElement, AnimatedCounterProps>(
  ({ value, prefix, suffix, formatOptions, locale = "en-US", decimals, duration, className, ...props }, ref) => {
    const springConfig = {
      stiffness: duration ? 100 / (duration / 0.5) : 100,
      damping: 30,
      mass: 1,
    };

    const spring = useSpring(0, springConfig);

    const resolvedOptions: Intl.NumberFormatOptions = formatOptions ?? (
      decimals !== undefined
        ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
        : {}
    );

    const display = useTransform(spring, (current) => {
      const rounded = decimals !== undefined ? current : Math.round(current);
      if (Object.keys(resolvedOptions).length > 0) {
        return new Intl.NumberFormat(locale, resolvedOptions).format(rounded);
      }
      return Math.round(current).toLocaleString(locale);
    });

    React.useEffect(() => {
      spring.set(value);
    }, [spring, value]);

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1 font-mono tabular-nums",
          className
        )}
        {...props}
      >
        {prefix && <span className="shrink-0">{prefix}</span>}
        <motion.span>{display}</motion.span>
        {suffix && <span className="shrink-0">{suffix}</span>}
      </span>
    );
  }
);
AnimatedCounter.displayName = "AnimatedCounter";
