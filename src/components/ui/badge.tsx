import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] uppercase",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-muted-foreground",
        verified: "border-border bg-secondary text-foreground",
        inferred: "border-border bg-accent text-accent-foreground",
        candidate: "border-border bg-background text-muted-foreground",
        strong: "border-border bg-secondary text-foreground",
        peripheral: "border-border bg-background text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "outline",
    },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
