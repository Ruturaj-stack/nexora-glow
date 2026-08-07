import { useCallback, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface VirtualListProps<T> {
  items: T[];
  /** Fixed row height in px — required for constant-time windowing. */
  itemHeight: number;
  height: number;
  overscan?: number;
  className?: string;
  renderItem: (item: T, index: number) => ReactNode;
  getKey?: (item: T, index: number) => string | number;
}

/**
 * Minimal fixed-height windowing list.
 *
 * Long histories (messages, logs, audit trails, MQTT traffic) render only the
 * visible slice, keeping DOM node count constant regardless of dataset size.
 */
export function VirtualList<T>({
  items,
  itemHeight,
  height,
  overscan = 6,
  className,
  renderItem,
  getKey,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const frame = useRef<number | null>(null);

  const onScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const next = event.currentTarget.scrollTop;
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      setScrollTop(next);
    });
  }, []);

  const total = items.length * itemHeight;
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleCount = Math.ceil(height / itemHeight) + overscan * 2;
  const end = Math.min(items.length, start + visibleCount);
  const slice = items.slice(start, end);

  return (
    <div className={cn("overflow-y-auto", className)} style={{ height }} onScroll={onScroll}>
      <div style={{ height: total, position: "relative" }}>
        <div style={{ transform: `translateY(${start * itemHeight}px)` }}>
          {slice.map((item, i) => (
            <div key={getKey?.(item, start + i) ?? start + i} style={{ height: itemHeight }}>
              {renderItem(item, start + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
