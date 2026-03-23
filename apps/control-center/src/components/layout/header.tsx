"use client";

import { usePathname } from "next/navigation";
import { ChevronRight, Github, Star, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();

  const getBreadcrumbs = (): { label: string; isCurrent: boolean }[] => {
    if (pathname === "/dashboard")
      return [{ label: "Monitors", isCurrent: true }];
    if (pathname === "/feed")
      return [{ label: "Live Feed", isCurrent: true }];
    if (pathname === "/monitors/new")
      return [
        { label: "Monitors", isCurrent: false },
        { label: "Create", isCurrent: true },
      ];
    if (pathname.includes("/monitors/"))
      return [
        { label: "Monitors", isCurrent: false },
        { label: "Details", isCurrent: true },
      ];
    return [{ label: "Vintrack", isCurrent: true }];
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-border/70 bg-background/72 px-4 backdrop-blur-xl md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="-ml-1.5 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        
        <nav className="hidden sm:flex items-center gap-1 text-sm">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />}
              <span
                className={
                  crumb.isCurrent
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }
              >
                {crumb.label}
              </span>
            </span>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <ThemeToggle compact className="hidden sm:inline-flex" />
        <a
          href="https://github.com/JakobAIOdev/Vintrack-Vinted-Monitor"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden items-center gap-1.5 rounded-md border border-border/80 bg-card/70 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400 sm:flex"
        >
          <Github className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Star us on GitHub</span>
          <Star className="w-3.5 h-3.5" />
        </a>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="hidden xs:inline">Connected</span>
        </div>
      </div>
    </header>
  );
}
