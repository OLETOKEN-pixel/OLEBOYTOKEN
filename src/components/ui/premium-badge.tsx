import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "live" | "gold" | "vip" | "new" | "status" | "open" | "completed" | "hot";

interface PremiumBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
  dot?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  live: "badge-live",
  gold: "badge-gold",
  vip: "badge-vip",
  new: "inline-flex items-center gap-1.5 text-[11px] font-medium text-[hsl(var(--teal))] bg-[hsl(var(--teal)/0.08)] border border-[hsl(var(--teal)/0.2)] rounded-full px-2.5 py-0.5",
  status: "badge-status",
  open: "inline-flex items-center gap-1.5 text-[11px] font-medium text-[hsl(var(--teal))] bg-[hsl(var(--teal)/0.08)] border border-[hsl(var(--teal)/0.2)] rounded-full px-2.5 py-0.5",
  completed: "inline-flex items-center text-[11px] font-medium text-[hsl(var(--text-secondary))] bg-[hsl(var(--bg-2))] border border-[hsl(var(--border-soft))] rounded-full px-2.5 py-0.5",
  hot: "inline-flex items-center gap-1.5 text-[11px] font-semibold text-[hsl(var(--error))] bg-[hsl(var(--error)/0.08)] border border-[hsl(var(--error)/0.2)] rounded-full px-2.5 py-0.5",
};

export const PremiumBadge = React.forwardRef<HTMLDivElement, PremiumBadgeProps>(
  ({ variant = "live", dot, children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "font-[var(--font-sans)] select-none",
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={cn(
              "inline-block w-1.5 h-1.5 rounded-full shrink-0",
              variant === "live" ? "bg-[hsl(var(--success))]" :
              variant === "hot" ? "bg-[hsl(var(--error))]" :
              variant === "gold" || variant === "vip" ? "bg-[hsl(var(--gold))]" :
              variant === "new" || variant === "open" ? "bg-[hsl(var(--teal))]" :
              "bg-[hsl(var(--text-tertiary))]"
            )}
          />
        )}
        {children}
      </div>
    );
  }
);
PremiumBadge.displayName = "PremiumBadge";
