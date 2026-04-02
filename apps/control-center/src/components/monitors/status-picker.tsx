"use client";

import { ITEM_STATUSES } from "@/lib/statuses";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface StatusPickerProps {
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function StatusPicker({ selected, onChange }: StatusPickerProps) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((value) => value !== id));
      return;
    }
    onChange([...selected, id]);
  };

  const toneClasses: Record<string, string> = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ITEM_STATUSES.map((status) => {
          const isSelected = selected.includes(status.id);
          return (
            <button
              key={status.id}
              type="button"
              onClick={() => toggle(status.id)}
              className={`group rounded-xl border px-3 py-3 text-left transition-all ${
                isSelected
                  ? "border-primary bg-accent text-accent-foreground shadow-sm"
                  : "border-input bg-background hover:border-border hover:bg-muted/50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium">{status.label}</span>
                  </div>
                  <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                    {status.description}
                  </p>
                </div>
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background text-transparent group-hover:border-primary/50"
                  )}
                >
                  <Check className="h-3 w-3" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
