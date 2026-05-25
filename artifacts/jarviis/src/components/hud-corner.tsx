import { cn } from "@/lib/utils";

interface HudCornerProps {
  position: "tl" | "tr" | "bl" | "br";
  size?: number;
  className?: string;
}

export function HudCorner({ position, size = 20, className }: HudCornerProps) {
  const borders: Record<string, string> = {
    tl: "border-t border-l",
    tr: "border-t border-r",
    bl: "border-b border-l",
    br: "border-b border-r",
  };

  return (
    <div
      className={cn("absolute border-cyan-400/50", borders[position], className)}
      style={{ width: size, height: size }}
    />
  );
}
