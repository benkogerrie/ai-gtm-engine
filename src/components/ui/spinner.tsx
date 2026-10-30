import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-border border-t-primary motion-reduce:animate-none",
        className,
      )}
    />
  );
}
