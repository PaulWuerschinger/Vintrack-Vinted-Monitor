"use client";

import { useState } from "react";
import { SIZE_GROUPS } from "@/lib/sizes";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SizePickerProps {
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function SizePicker({ selected, onChange }: SizePickerProps) {
  const [activeGroup, setActiveGroup] = useState<string>("14");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const group = SIZE_GROUPS.find((g) => g.key === activeGroup);

  const toggle = (id: number) => {
    const sid = String(id);
    if (selected.includes(sid)) {
      onChange(selected.filter((s) => s !== sid));
    } else {
      onChange([...selected, sid]);
    }
  };

  const activeLabel =
    SIZE_GROUPS.find((g) => g.key === activeGroup)?.label ?? "Size Type";

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full h-9 px-3 rounded-md border border-input bg-background text-[13px] text-left flex items-center justify-between hover:bg-muted transition-colors"
        >
          <span className="truncate">{activeLabel}</span>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform",
              dropdownOpen && "rotate-180"
            )}
          />
        </button>
        {dropdownOpen && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-background shadow-lg">
            {SIZE_GROUPS.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => {
                  setActiveGroup(g.key);
                  setDropdownOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-[13px] hover:bg-muted transition-colors",
                  activeGroup === g.key && "bg-muted font-medium"
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {group && (
        <div className="flex flex-wrap gap-1.5">
          {group.sizes.map((size) => {
            const isSelected = selected.includes(String(size.id));
            return (
              <button
                key={size.id}
                type="button"
                onClick={() => toggle(size.id)}
                className={cn(
                  "h-8 px-3 rounded-lg text-[13px] font-medium border transition-colors flex items-center gap-1.5",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted border-input text-muted-foreground"
                )}
              >
                {size.label}
                {isSelected && <Check className="w-3 h-3" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
