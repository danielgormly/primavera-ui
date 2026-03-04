import type { Key } from "./dnd-types";

export interface VirtualRange {
  startIndex: number;
  endIndex: number;
}

export class DndVirtualization {
  constructor(
    private itemHeight: number,
    private overscan: number = 2,
  ) {}

  setItemHeight(h: number): void {
    this.itemHeight = h;
  }

  setOverscan(o: number): void {
    this.overscan = o;
  }

  /** Calculate the range of indices to render. */
  calculateRange(
    scrollTop: number,
    viewportHeight: number,
    totalItems: number,
  ): VirtualRange {
    const startIndex = Math.max(
      Math.floor(scrollTop / this.itemHeight) - this.overscan,
      0,
    );
    const endIndex = Math.min(
      startIndex + Math.ceil(viewportHeight / this.itemHeight) + this.overscan * 2,
      totalItems,
    );
    return { startIndex, endIndex };
  }

  /** Total scrollable height including 2-item buffer at end. */
  getTotalHeight(itemCount: number): number {
    return (itemCount + 2) * this.itemHeight;
  }

  /** Top position for an item at a given index. */
  getItemTop(index: number): number {
    return index * this.itemHeight;
  }

  /** Find which item index is at a given Y coordinate (relative to list top). */
  getIndexAtY(y: number, totalItems: number): number {
    const idx = Math.floor(y / this.itemHeight);
    return Math.max(0, Math.min(idx, totalItems - 1));
  }

  /** Get the scroll offset needed to bring an item into view. Returns null if already visible. */
  getScrollToOffset(
    index: number,
    scrollTop: number,
    viewportHeight: number,
  ): number | null {
    const itemTop = this.getItemTop(index);
    const itemBottom = itemTop + this.itemHeight;

    if (itemTop < scrollTop) {
      return itemTop;
    }
    if (itemBottom > scrollTop + viewportHeight) {
      return itemBottom - viewportHeight;
    }
    return null;
  }
}
