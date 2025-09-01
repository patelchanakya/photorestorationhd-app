import { useCallback, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

interface UseHorizontalVisibilityOptions {
  itemWidth: number;
  itemSpacing?: number;
  overscanItems?: number; // how many extra items to consider visible on each side
  leadingInset?: number; // horizontal padding before first item inside the scroller
}

interface UseHorizontalVisibilityResult {
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onContainerLayout: (e: LayoutChangeEvent) => void;
  isIndexVisible: (index: number) => boolean;
  isIndexCoreVisible: (index: number) => boolean; // without overscan padding
  visibleRange: { start: number; end: number };
}

export function useHorizontalVisibility(
  options: UseHorizontalVisibilityOptions
): UseHorizontalVisibilityResult {
  const { itemWidth, itemSpacing = 0, overscanItems = 1, leadingInset = 0 } = options;

  const [containerWidth, setContainerWidth] = useState(0);
  const scrollXRef = useRef(0);
  const rangeRef = useRef({ start: 0, end: 0 });
  const coreRangeRef = useRef({ start: 0, end: 0 });
  const [, forceRender] = useState(0);

  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.max(0, Math.round(e.nativeEvent.layout.width));
    if (w !== containerWidth) {
      setContainerWidth(w);
      // compute initial visible range
      const total = itemWidth + itemSpacing;
      const x = Math.max(0, scrollXRef.current - leadingInset);
      const approxStart = Math.floor(x / Math.max(1, total)) - overscanItems;
      const start = Math.max(0, approxStart);
      const approxEnd = Math.ceil((x + w) / Math.max(1, total)) + overscanItems;
      const end = Math.max(0, approxEnd);
      rangeRef.current = { start, end };
      // compute core range (no overscan)
      const coreStart = Math.max(0, Math.floor(x / Math.max(1, total)));
      const coreEnd = Math.max(0, Math.ceil((x + w) / Math.max(1, total)));
      coreRangeRef.current = { start: coreStart, end: coreEnd };
      // force recompute
      forceRender((xForce) => xForce + 1);
    }
  }, [containerWidth, itemSpacing, itemWidth, overscanItems, leadingInset]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const rawX = Math.max(0, e.nativeEvent.contentOffset.x);
    const x = Math.max(0, rawX - leadingInset);
    scrollXRef.current = x;
    // compute visible range lazily; request a render tick only if range changed
    const total = itemWidth + itemSpacing;
    const approxStart = Math.floor(x / Math.max(1, total)) - overscanItems;
    const start = Math.max(0, approxStart);
    const approxEnd = Math.ceil((x + containerWidth) / Math.max(1, total)) + overscanItems;
    const end = Math.max(0, approxEnd);

    // compute core range (without overscan)
    const coreStart = Math.max(0, Math.floor(x / Math.max(1, total)));
    const coreEnd = Math.max(0, Math.ceil((x + containerWidth) / Math.max(1, total)));

    if (
      start !== rangeRef.current.start ||
      end !== rangeRef.current.end ||
      coreStart !== coreRangeRef.current.start ||
      coreEnd !== coreRangeRef.current.end
    ) {
      rangeRef.current = { start, end };
      coreRangeRef.current = { start: coreStart, end: coreEnd };
      forceRender((t) => t + 1);
    }
  }, [containerWidth, itemSpacing, itemWidth, overscanItems, leadingInset]);

  const isIndexVisible = useCallback((index: number) => {
    return index >= rangeRef.current.start && index <= rangeRef.current.end;
  }, []);

  const isIndexCoreVisible = useCallback((index: number) => {
    return index >= coreRangeRef.current.start && index <= coreRangeRef.current.end;
  }, []);

  const visibleRange = useMemo(() => rangeRef.current, []);

  return { onScroll, onContainerLayout, isIndexVisible, isIndexCoreVisible, visibleRange };
}


