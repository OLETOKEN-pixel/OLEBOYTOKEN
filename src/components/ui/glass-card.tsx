import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

const variantStyles = {
  default: "premium-card",
  elevated: "premium-surface-elevated",
  gold: "premium-card border-[hsl(var(--border-gold))]",
  glass: "premium-glass",
} as const;

type PremiumCardVariant = keyof typeof variantStyles;

interface PremiumCardProps extends Omit<HTMLMotionProps<"div">, "onClick"> {
  variant?: PremiumCardVariant;
  highlight?: boolean;
  children?: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export const PremiumCard = React.forwardRef<HTMLDivElement, PremiumCardProps>(
  ({ variant = "default", highlight = false, children, className, onClick, ...props }, ref) => (
    <motion.div
      ref={ref}
      whileHover={{
        y: -2,
        borderColor: "hsl(0 0% 20%)",
      }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      onClick={onClick}
      className={cn(
        "relative p-4 rounded-2xl",
        variantStyles[variant],
        highlight && "premium-highlight",
        onClick && "cursor-pointer",
        className
      )}
      {...props}
    >
      <div className="relative z-[1]">{children}</div>
    </motion.div>
  )
);
PremiumCard.displayName = "PremiumCard";

export const GlassCard = PremiumCard;
export const HudCard = PremiumCard;
