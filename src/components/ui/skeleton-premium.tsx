import * as React from "react";
import { cn } from "@/lib/utils";

const variantStyles = {
  card: "h-40 w-full rounded-2xl",
  text: "h-4 w-3/4 rounded-md",
  avatar: "h-10 w-10 rounded-full",
  button: "h-10 w-28 rounded-xl",
} as const;

type SkeletonVariant = keyof typeof variantStyles;

interface SkeletonPremiumProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
}

export const SkeletonPremium = React.forwardRef<HTMLDivElement, SkeletonPremiumProps>(
  ({ variant = "text", className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "skeleton-premium",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  )
);
SkeletonPremium.displayName = "SkeletonPremium";
