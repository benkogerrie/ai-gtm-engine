import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

/** Right-hand sheet over a dim backdrop. Closes on ×, Escape or backdrop click. */
export function Overlay({ onClose, children, footer }: { onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground/20 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <aside role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="relative flex h-full w-full max-w-xl flex-col bg-card shadow-2xl animate-in slide-in-from-right duration-300 motion-reduce:animate-none">
        <button onClick={onClose} className="absolute top-5 right-5 z-10 rounded-lg p-1.5 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label="Close"><X className="size-5" /></button>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
        {footer && <div className="border-t p-5">{footer}</div>}
      </aside>
    </div>
  );
}
