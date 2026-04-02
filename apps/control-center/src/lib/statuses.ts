export type ItemStatus = {
  id: string;
  label: string;
  description: string;
  tone: string;
};

export const ITEM_STATUSES: ItemStatus[] = [
  { id: "6", label: "New with tags", description: "Unused item with original tags attached.", tone: "emerald" },
  { id: "1", label: "New", description: "Unused item without visible wear.", tone: "sky" },
  { id: "2", label: "Very good", description: "Light wear, still looks almost new.", tone: "indigo" },
  { id: "3", label: "Good", description: "Visible wear, but still in solid condition.", tone: "amber" },
  { id: "4", label: "Satisfactory", description: "Noticeable wear or flaws are acceptable.", tone: "rose" },
];

const ITEM_STATUS_BY_ID: Record<string, ItemStatus> = Object.create(null);
for (const status of ITEM_STATUSES) {
  ITEM_STATUS_BY_ID[status.id] = status;
}

export function getStatusValues(statusIds: string | null | undefined): string[] {
  if (!statusIds) return [];

  return statusIds
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function getStatusLabels(statusIds: string | null | undefined): string[] {
  return getStatusValues(statusIds).map((id) => ITEM_STATUS_BY_ID[id]?.label ?? `Status ${id}`);
}
