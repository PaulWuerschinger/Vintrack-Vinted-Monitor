"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { ItemCard, ItemCardSkeleton, type ItemData } from "@/components/monitors/item-card";
import { useMonitorLiveContext } from "@/components/monitors/monitor-live-context";

const POLL_INTERVAL_MS = 1000;

export function LiveFeed({ monitorId }: { monitorId: number }) {
  const [items, setItems] = useState<ItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const { incrementItemCount } = useMonitorLiveContext();
  const seenItemIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const fetchItems = async (isInitial: boolean) => {
      try {
        const res = await fetch(`/api/monitors/${monitorId}/items`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data: ItemData[] = await res.json();

        if (isInitial) {
          seenItemIds.current = new Set(data.map((item) => String(item.id)));
          setItems(data.map((i) => ({ ...i, id: String(i.id), isLive: false })));
          return;
        }

        const fresh: ItemData[] = [];
        for (const item of data) {
          const id = String(item.id);
          if (!seenItemIds.current.has(id)) {
            seenItemIds.current.add(id);
            fresh.push({ ...item, id, isLive: true });
            incrementItemCount();
          }
        }
        if (fresh.length === 0) return;

        setItems((prev) => [...fresh, ...prev]);

        for (const f of fresh) {
          const freshId = f.id;
          setTimeout(() => {
            setItems((curr) =>
              curr.map((item) => (String(item.id) === String(freshId) ? { ...item, isLive: false } : item))
            );
          }, 10000);
        }
      } catch (err) {
        console.error("Poll error", err);
      }
    };

    fetchItems(true).finally(() => {
      if (!cancelled) setLoading(false);
    });
    const interval = setInterval(() => fetchItems(false), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [incrementItemCount, monitorId]);

  useEffect(() => {
    const eventSource = new EventSource("/api/stream");

    eventSource.onmessage = (event) => {
      try {
        const newItem: ItemData = JSON.parse(event.data);

        if (newItem.monitor_id === monitorId) {
          const newId = String(newItem.id);
          const liveItem: ItemData = { ...newItem, id: newId, isLive: true };
          const isExisting = seenItemIds.current.has(newId);

          if (!isExisting) {
            seenItemIds.current.add(newId);
            incrementItemCount();
          }

          setItems((prev) => {
            const existingIdx = prev.findIndex((i) => String(i.id) === newId);
            if (existingIdx !== -1) {
              const existing = prev[existingIdx];
              const merged = {
                ...existing,
                location: newItem.location || existing.location,
                rating: newItem.rating || existing.rating,
                seller_id: newItem.seller_id || existing.seller_id,
                total_price: newItem.total_price || existing.total_price,
                extra_images: newItem.extra_images || existing.extra_images,
              };
              const updated = [...prev];
              updated[existingIdx] = merged;
              return updated;
            }
            return [liveItem, ...prev];
          });

          setTimeout(() => {
            setItems((curr) =>
              curr.map((item) =>
                String(item.id) === String(newItem.id) ? { ...item, isLive: false } : item
              )
            );
          }, 10000);
        }
      } catch (e) {
        console.error("SSE Parse Error", e);
      }
    };

    return () => eventSource.close();
  }, [incrementItemCount, monitorId]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
      {loading && items.length === 0
        ? [...Array(5)].map((_, i) => <ItemCardSkeleton key={i} />)
        : items.map((item) => <ItemCard key={item.id} item={item} />)}

      {items.length === 0 && !loading && (
        <div className="col-span-full flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-2xl bg-card">
          <div className="bg-muted p-3 rounded-xl mb-4">
            <Search className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            No items found yet
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm text-center">
            Items will appear here in real-time as the worker finds them.
          </p>
        </div>
      )}
    </div>
  );
}
