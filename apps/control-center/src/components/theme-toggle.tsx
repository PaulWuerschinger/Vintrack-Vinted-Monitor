"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  compact?: boolean;
}

export function ThemeToggle({
  className,
  compact = false,
}: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();

  if (!resolvedTheme) {
    return (
      <div
        className={cn(
          compact
            ? "h-8 w-8 rounded-lg border border-border/70 bg-background/60"
            : "h-9 w-full rounded-xl border border-border/70 bg-background/60",
          className
        )}
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "inline-flex items-center border border-border/70 bg-background/70 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent hover:text-accent-foreground",
        compact
          ? "h-8 w-8 justify-center rounded-lg"
          : "h-9 w-full justify-between rounded-xl px-3",
        className
      )}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="flex items-center gap-2">
        {isDark ? (
          <MoonStar className="h-4 w-4" />
        ) : (
          <SunMedium className="h-4 w-4" />
        )}
        {!compact && (
          <span className="text-xs font-medium">
            {isDark ? "Dark Mode" : "Light Mode"}
          </span>
        )}
      </span>
      {!compact && (
        <span className="text-[11px] text-muted-foreground">
          {isDark ? "On" : "Off"}
        </span>
      )}
    </button>
  );
}
