import type { Key, Block, Selection } from "./dnd-types";

/**
 * Multi-block selection model with merge logic.
 *
 * Blocks are contiguous ranges defined by (anchor, to). The anchor is the
 * stable end set when the block is created; `to` is the fluid end that moves
 * during shift-extend operations. Blocks are always stored sorted by their
 * top position in the list and never overlap — the merge step guarantees this.
 */
export class DndSelection {
  private blocks: Block[] = [];
  private active: Block | null = null;

  /** Key → position index for O(1) lookups. */
  private orderIndex = new Map<Key, number>();
  /** Position → key (reverse of orderIndex). */
  private indexToKey: Key[] = [];

  constructor(order: readonly Key[]) {
    this.updateOrder(order);
  }

  // ── Order management ────────────────────────────────────────────

  updateOrder(order: readonly Key[]): void {
    this.orderIndex.clear();
    this.indexToKey = [...order];
    for (let i = 0; i < order.length; i++) {
      this.orderIndex.set(order[i], i);
    }
  }

  // ── Queries ─────────────────────────────────────────────────────

  getSelection(): Selection {
    return { blocks: this.blocks, active: this.active };
  }

  isSelected(key: Key): boolean {
    for (const block of this.blocks) {
      if (this.keyInBlock(key, block)) return true;
    }
    return false;
  }

  /** Returns selected keys in list order. */
  getSelectedKeys(): Key[] {
    const keys: Key[] = [];
    for (const block of this.blocks) {
      const [top, bottom] = this.blockRange(block);
      for (let i = top; i <= bottom; i++) {
        keys.push(this.indexToKey[i]);
      }
    }
    return keys;
  }

  hasSelection(): boolean {
    return this.blocks.length > 0;
  }

  getActiveBlock(): Block | null {
    return this.active;
  }

  /** Get the topmost selected key. */
  getSelectionTop(): Key | null {
    if (this.blocks.length === 0) return null;
    return this.indexToKey[this.blockTop(this.blocks[0])];
  }

  /** Get the bottommost selected key. */
  getSelectionBottom(): Key | null {
    if (this.blocks.length === 0) return null;
    return this.indexToKey[this.blockBottom(this.blocks[this.blocks.length - 1])];
  }

  // ── Operations ──────────────────────────────────────────────────

  selectOnly(item: Key): void {
    const block: Block = { anchor: item, to: item };
    this.blocks = [block];
    this.active = block;
  }

  addBlock(item: Key): void {
    const block: Block = { anchor: item, to: item };
    this.blocks.push(block);
    this.active = block;
    this.merge();
  }

  extendActive(item: Key): void {
    if (!this.active) {
      this.selectOnly(item);
      return;
    }
    this.active.to = item;
    this.merge();
  }

  toggleItem(item: Key): void {
    if (this.isSelected(item)) {
      this.removeItem(item);
    } else {
      this.addBlock(item);
    }
  }

  moveSelection(dir: "up" | "down"): void {
    if (this.blocks.length === 0) return;

    const delta = dir === "up" ? -1 : 1;
    const totalItems = this.indexToKey.length;

    // Check if movement is possible (all blocks can shift without going out of bounds)
    for (const block of this.blocks) {
      const [top, bottom] = this.blockRange(block);
      if (dir === "up" && top <= 0) return;
      if (dir === "down" && bottom >= totalItems - 1) return;
    }

    // Shift all blocks
    for (const block of this.blocks) {
      const anchorIdx = this.orderIndex.get(block.anchor)!;
      const toIdx = this.orderIndex.get(block.to)!;
      block.anchor = this.indexToKey[anchorIdx + delta];
      block.to = this.indexToKey[toIdx + delta];
    }

    this.merge();
  }

  clear(): void {
    this.blocks = [];
    this.active = null;
  }

  // ── Relative identifiers ───────────────────────────────────────

  first(): Key {
    return this.indexToKey[0];
  }

  last(): Key {
    return this.indexToKey[this.indexToKey.length - 1];
  }

  next(item: Key): Key {
    const idx = this.orderIndex.get(item);
    if (idx === undefined) return item;
    return idx < this.indexToKey.length - 1 ? this.indexToKey[idx + 1] : item;
  }

  prev(item: Key): Key {
    const idx = this.orderIndex.get(item);
    if (idx === undefined) return item;
    return idx > 0 ? this.indexToKey[idx - 1] : item;
  }

  activeTop(): Key | null {
    if (!this.active) return null;
    return this.indexToKey[this.blockTop(this.active)];
  }

  activeBottom(): Key | null {
    if (!this.active) return null;
    return this.indexToKey[this.blockBottom(this.active)];
  }

  // ── Private helpers ─────────────────────────────────────────────

  private removeItem(item: Key): void {
    const itemIdx = this.orderIndex.get(item);
    if (itemIdx === undefined) return;

    const newBlocks: Block[] = [];

    for (const block of this.blocks) {
      const [top, bottom] = this.blockRange(block);

      if (itemIdx < top || itemIdx > bottom) {
        // Item not in this block
        newBlocks.push(block);
        continue;
      }

      if (top === bottom) {
        // Single-item block, remove entirely
        if (this.active === block) this.active = null;
        continue;
      }

      if (itemIdx === top) {
        // Remove from top
        block.anchor = this.indexToKey[top + 1];
        block.to = this.indexToKey[bottom];
        newBlocks.push(block);
      } else if (itemIdx === bottom) {
        // Remove from bottom
        block.anchor = this.indexToKey[top];
        block.to = this.indexToKey[bottom - 1];
        newBlocks.push(block);
      } else {
        // Split: item is interior
        const upper: Block = {
          anchor: this.indexToKey[top],
          to: this.indexToKey[itemIdx - 1],
        };
        const lower: Block = {
          anchor: this.indexToKey[itemIdx + 1],
          to: this.indexToKey[bottom],
        };
        newBlocks.push(upper, lower);
        if (this.active === block) {
          this.active = lower;
        }
      }
    }

    this.blocks = newBlocks;

    // If active was removed, pick nearest remaining
    if (this.active === null && this.blocks.length > 0) {
      // Pick the block closest to the removed item
      let closest = this.blocks[0];
      let closestDist = Infinity;
      for (const b of this.blocks) {
        const [t, bo] = this.blockRange(b);
        const dist = Math.min(
          Math.abs(t - itemIdx),
          Math.abs(bo - itemIdx),
        );
        if (dist < closestDist) {
          closestDist = dist;
          closest = b;
        }
      }
      this.active = closest;
    }
  }

  private merge(): void {
    if (this.blocks.length <= 1) return;

    // Sort blocks by their top position
    this.blocks.sort(
      (a, b) => this.blockTop(a) - this.blockTop(b),
    );

    const merged: Block[] = [];
    let current = this.blocks[0];
    let currentActiveConsumed = this.active === current;

    for (let i = 1; i < this.blocks.length; i++) {
      const next = this.blocks[i];
      const currentBottom = this.blockBottom(current);
      const nextTop = this.blockTop(next);

      if (currentBottom + 1 >= nextTop) {
        // Adjacent or overlapping — merge
        const newTop = this.blockTop(current);
        const newBottom = Math.max(currentBottom, this.blockBottom(next));
        current = {
          anchor: this.indexToKey[newTop],
          to: this.indexToKey[newBottom],
        };
        if (this.active === next) currentActiveConsumed = true;
      } else {
        merged.push(current);
        current = next;
        currentActiveConsumed = this.active === next;
      }
    }
    merged.push(current);

    // Update active if it was consumed
    if (currentActiveConsumed || !merged.includes(this.active!)) {
      // Find the merged block that contains the original active
      if (this.active) {
        const activeTop = this.blockTop(this.active);
        for (const b of merged) {
          const [t, bo] = this.blockRange(b);
          if (activeTop >= t && activeTop <= bo) {
            this.active = b;
            break;
          }
        }
      }
    }

    this.blocks = merged;
  }

  /** Get [topIndex, bottomIndex] for a block, handling anchor > to. */
  private blockRange(block: Block): [number, number] {
    const a = this.orderIndex.get(block.anchor) ?? 0;
    const b = this.orderIndex.get(block.to) ?? 0;
    return a <= b ? [a, b] : [b, a];
  }

  private blockTop(block: Block): number {
    return this.blockRange(block)[0];
  }

  private blockBottom(block: Block): number {
    return this.blockRange(block)[1];
  }

  private keyInBlock(key: Key, block: Block): boolean {
    const idx = this.orderIndex.get(key);
    if (idx === undefined) return false;
    const [top, bottom] = this.blockRange(block);
    return idx >= top && idx <= bottom;
  }
}
