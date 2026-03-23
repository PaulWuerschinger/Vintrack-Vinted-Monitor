"use client";

import { useState } from "react";
import { CATEGORIES, type Category } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { Check, ChevronRight, X } from "lucide-react";

interface CategoryPickerProps {
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function CategoryPicker({ selected, onChange }: CategoryPickerProps) {
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);

  const toggle = (id: number) => {
    const idStr = String(id);
    if (selected.includes(idStr)) {
      onChange(selected.filter((s) => s !== idStr));
    } else {
      onChange([...selected, idStr]);
    }
  };

  const isSelected = (id: number) => selected.includes(String(id));

  const findLabel = (id: string): string => {
    for (const group of CATEGORIES) {
      if (String(group.id) === id) return group.label;
      for (const child of group.children) {
        if (String(child.id) === id) return `${group.label} › ${child.label}`;
      }
    }
    return id;
  };

  return (
    <div className="space-y-2.5">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[12px] text-primary-foreground border border-primary"
            >
              {findLabel(id)}
              <button
                type="button"
                onClick={() => onChange(selected.filter((s) => s !== id))}
                className="text-slate-400 hover:text-muted-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="border border-input rounded-lg overflow-hidden max-h-60 overflow-y-auto">
        {CATEGORIES.map((group) => (
          <div key={group.id}>
            <div className="flex items-center border-b border-slate-100 last:border-b-0">
              <button
                type="button"
                onClick={() => toggle(group.id)}
                className={cn(
                  "shrink-0 w-8 h-9 flex items-center justify-center border-r border-slate-100",
                  isSelected(group.id)
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted text-slate-300"
                )}
              >
                {isSelected(group.id) && <Check className="w-3.5 h-3.5 text-primary" />}
              </button>
              <button
                type="button"
                onClick={() =>
                  setExpandedGroup(
                    expandedGroup === group.id ? null : group.id
                  )
                }
                className="flex-1 flex items-center justify-between px-3 h-9 text-[13px] font-medium text-foreground hover:bg-muted transition-colors"
              >
                {group.label}
                <ChevronRight
                  className={cn(
                    "w-3.5 h-3.5 text-slate-400 transition-transform",
                    expandedGroup === group.id && "rotate-90"
                  )}
                />
              </button>
            </div>

            {expandedGroup === group.id && group.children.length > 0 && (
              <div className="bg-muted/50">
                {group.children.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => toggle(child.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 pl-11 pr-3 h-8 text-[12px] border-b border-slate-100/80 last:border-b-0 transition-colors",
                      isSelected(child.id)
                        ? "text-foreground font-medium bg-muted/60"
                        : "text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    <span
                      className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                        isSelected(child.id)
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-border bg-background"
                      )}
                    >
                      {isSelected(child.id) && (
                        <Check className="w-2.5 h-2.5" />
                      )}
                    </span>
                    {child.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
