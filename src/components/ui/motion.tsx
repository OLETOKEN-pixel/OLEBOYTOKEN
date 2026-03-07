import * as React from "react";
import { motion, useSpring, useTransform, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type MotionDivProps = HTMLMotionProps<"div"> & {
  children?: React.ReactNode;
  className?: string;
};

const cleanEase = [0.25, 0.46, 0.45, 0.94] as const;

export const FadeIn = React.forwardRef<HTMLDivElement, MotionDivProps & { delay?: number }>(
  ({ children, delay = 0, className, ...props }, ref) => (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: cleanEase }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  )
);
FadeIn.displayName = "FadeIn";

export const ScaleIn = React.forwardRef<HTMLDivElement, MotionDivProps & { delay?: number }>(
  ({ children, delay = 0, className, ...props }, ref) => (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, delay, ease: cleanEase }}
      className={cn(className)}
      style={{ willChange: "transform, opacity" }}
      {...props}
    >
      {children}
    </motion.div>
  )
);
ScaleIn.displayName = "ScaleIn";

export const SlideIn = React.forwardRef<
  HTMLDivElement,
  MotionDivProps & { delay?: number; direction?: "left" | "right" }
>(({ children, delay = 0, direction = "left", className, ...props }, ref) => (
  <motion.div
    ref={ref}
    initial={{ opacity: 0, x: direction === "left" ? -20 : 20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.4, delay, ease: cleanEase }}
    className={cn(className)}
    {...props}
  >
    {children}
  </motion.div>
));
SlideIn.displayName = "SlideIn";

export const StaggerContainer = React.forwardRef<
  HTMLDivElement,
  MotionDivProps & { staggerDelay?: number }
>(({ children, staggerDelay = 0.06, className, ...props }, ref) => (
  <motion.div
    ref={ref}
    variants={{
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: staggerDelay,
          delayChildren: 0.05,
        },
      },
    }}
    initial="hidden"
    animate="visible"
    className={cn(className)}
    {...props}
  >
    {children}
  </motion.div>
));
StaggerContainer.displayName = "StaggerContainer";

export const StaggerItem = React.forwardRef<HTMLDivElement, MotionDivProps>(
  ({ children, className, ...props }, ref) => (
    <motion.div
      ref={ref}
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.35, ease: cleanEase },
        },
      }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  )
);
StaggerItem.displayName = "StaggerItem";

export const PageTransition = React.forwardRef<HTMLDivElement, MotionDivProps>(
  ({ children, className, ...props }, ref) => (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.3, ease: cleanEase }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  )
);
PageTransition.displayName = "PageTransition";

export const HoverLift = React.forwardRef<
  HTMLDivElement,
  MotionDivProps
>(({ children, className, ...props }, ref) => (
  <motion.div
    ref={ref}
    whileHover={{ y: -2, boxShadow: "0 8px 32px hsl(0 0% 0% / 0.4)" }}
    whileTap={{ scale: 0.98 }}
    transition={{ type: "spring", stiffness: 300, damping: 24 }}
    className={cn(className)}
    {...props}
  >
    {children}
  </motion.div>
));
HoverLift.displayName = "HoverLift";

export const HoverScale = HoverLift;

export const PremiumReveal = React.forwardRef<
  HTMLDivElement,
  MotionDivProps & { delay?: number }
>(({ children, delay = 0, className, ...props }, ref) => (
  <motion.div
    ref={ref}
    initial={{ opacity: 0, scale: 0.96, y: 8 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    transition={{
      type: "spring",
      stiffness: 200,
      damping: 20,
      delay,
    }}
    className={cn(className)}
    {...props}
  >
    {children}
  </motion.div>
));
PremiumReveal.displayName = "PremiumReveal";

interface AnimatedNumberProps extends Omit<HTMLMotionProps<"span">, "children"> {
  value: number;
  className?: string;
  formatOptions?: Intl.NumberFormatOptions;
}

export const AnimatedNumber = React.forwardRef<HTMLSpanElement, AnimatedNumberProps>(
  ({ value, className, formatOptions, ...props }, ref) => {
    const spring = useSpring(0, { stiffness: 100, damping: 30, mass: 1 });
    const display = useTransform(spring, (current) => {
      if (formatOptions) {
        return new Intl.NumberFormat("en-US", formatOptions).format(Math.round(current));
      }
      return Math.round(current).toLocaleString();
    });

    React.useEffect(() => {
      spring.set(value);
    }, [spring, value]);

    return (
      <motion.span ref={ref} className={cn("font-mono tabular-nums", className)} {...props}>
        {display}
      </motion.span>
    );
  }
);
AnimatedNumber.displayName = "AnimatedNumber";
