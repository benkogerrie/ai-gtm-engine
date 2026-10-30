import type { LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("block text-sm leading-none text-foreground", className)}
      {...props}
    />
  );
}

export { Label };
