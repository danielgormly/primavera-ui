import type { Key, DndOp, DndRenderer, DragContext } from "./dnd-types";
import { DndSource } from "./dnd-source";
import { DndSelection } from "./dnd-selection";
import { DndVirtualization, type VirtualRange } from "./dnd-virtualization";
import { mapDndKeyEvent } from "./dnd-keyboard";
import { DndCanvas } from "./dnd-canvas";
import { DndAutoscroll } from "./dnd-autoscroll";
import { DndDragOverlay } from "./dnd-drag-overlay";
import { DndDragNative } from "./dnd-drag-native";
import { DndTouch } from "./dnd-touch";

const DRAG_BUFFER_PX = 3;

interface RenderedItem {
  element: HTMLElement;
  cleanup: () => void;
  index: number;
}

/**
 * <primavera-dnd> — Virtualized drag-and-drop list with multi-select.
 *
 * No Shadow DOM. Consumer provides a DndSource and DndRenderer.
 */
export class PrimaveraDnd extends HTMLElement {
  // ── Subsystems ──────────────────────────────────────────────────
  private source: DndSource<any> | null = null;
  private renderer: DndRenderer<any> | null = null;
  private selection!: DndSelection;
  private virtualization!: DndVirtualization;
  private canvas!: DndCanvas;
  private autoscroll!: DndAutoscroll;
  private dragOverlay!: DndDragOverlay;
  private dragNative: DndDragNative<any> | null = null;
  private touch!: DndTouch;

  // ── DOM ─────────────────────────────────────────────────────────
  private parent!: HTMLElement;
  private listbox!: HTMLElement;
  private styleEl!: HTMLStyleElement;

  // ── State ───────────────────────────────────────────────────────
  private renderedItems = new Map<Key, RenderedItem>();
  private currentRange: VirtualRange = { startIndex: 0, endIndex: 0 };
  private initialized = false;
  private resizeObserver: ResizeObserver | null = null;
  private sourceUnsub: (() => void) | null = null;

  // Drag state
  private isDragging = false;
  private mouseDownPos: { x: number; y: number } | null = null;
  private mouseDownKey: Key | null = null;
  private hoverIndex: number | null = null;
  private scrollRaf: number | null = null;
  private lastPointerPos: { x: number; y: number } | null = null;
  private draggedKeys: Key[] = [];

  // ── Attribute helpers ───────────────────────────────────────────

  private get dragType(): "native" | "overlay" {
    return (
      (this.getAttribute("drag-type") as "native" | "overlay") || "overlay"
    );
  }

  private get overscan(): number {
    return parseInt(this.getAttribute("overscan") || "2", 10);
  }

  private get roundedSelect(): boolean {
    return this.getAttribute("rounded-select") !== "false";
  }

  private get shouldAutofocus(): boolean {
    return this.hasAttribute("autofocus");
  }

  private get itemHeight(): number {
    return parseInt(this.getAttribute("item-height") || "32", 10);
  }

  private get confineAutoscroll(): boolean {
    return this.getAttribute("confine-autoscroll") !== "false";
  }

  private get autoscrollBuffer(): number {
    return parseInt(this.getAttribute("autoscroll-buffer") || "32", 10);
  }

  private get dragStackCount(): number {
    return parseInt(this.getAttribute("drag-stack-count") || "3", 10);
  }

  private get nudge(): boolean {
    return this.getAttribute("nudge") !== "false";
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  connectedCallback(): void {
    if (this.initialized) return;
    this.init();
  }

  disconnectedCallback(): void {
    this.cleanup();
  }

  // ── Public API ──────────────────────────────────────────────────

  setSource(source: DndSource<any>): void {
    if (this.sourceUnsub) this.sourceUnsub();
    this.source = source;
    this.selection = new DndSelection(source.getOrder());

    this.sourceUnsub = source.onChange(() => {
      this.selection.updateOrder(source.getOrder());
      this.renderList();
    });

    if (this.initialized) {
      this.renderList();
    }
  }

  setRenderer(renderer: DndRenderer<any>): void {
    this.renderer = renderer;
    if (this.dragNative) this.dragNative.setRenderer(renderer);
    if (this.initialized && this.source) {
      this.clearAllItems();
      this.renderList();
    }
  }

  getSelection() {
    return this.selection?.getSelection() ?? { blocks: [], active: null };
  }

  // ── Init ────────────────────────────────────────────────────────

  private init(): void {
    this.setupDOM();
    this.virtualization = new DndVirtualization(this.itemHeight, this.overscan);
    this.canvas = new DndCanvas(this.itemHeight);
    this.autoscroll = new DndAutoscroll(
      this.parent,
      this.autoscrollBuffer,
      this.confineAutoscroll,
    );
    this.dragOverlay = new DndDragOverlay(this.dragStackCount);
    this.touch = new DndTouch();

    // Insert canvas as sibling of parent (outside scroll container)
    this.appendChild(this.canvas.getElement());

    // Resize observer for canvas
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.canvas.resize(width, height);
      }
    });
    this.resizeObserver.observe(this.parent);

    // Events
    this.parent.addEventListener("scroll", this.onScroll, { passive: true });
    this.listbox.addEventListener("keydown", this.onKeyDown);
    this.listbox.addEventListener("mousedown", this.onMouseDown);
    this.listbox.addEventListener("click", this.onClick);
    this.listbox.addEventListener("touchstart", this.onTouchStart, {
      passive: false,
    });
    this.listbox.addEventListener("touchmove", this.onTouchMove, {
      passive: false,
    });
    this.listbox.addEventListener("touchend", this.onTouchEnd);

    // Init selection if source already set
    if (this.source) {
      this.selection = new DndSelection(this.source.getOrder());
      if (this.dragType === "native" && this.renderer) {
        this.dragNative = new DndDragNative(this.renderer);
      }
    } else {
      this.selection = new DndSelection([]);
    }

    this.initialized = true;

    if (this.source) {
      this.renderList();
    }

    if (this.shouldAutofocus) {
      queueMicrotask(() => this.listbox.focus());
    }
  }

  private setupDOM(): void {
    // The custom element itself is the positioning context
    this.style.cssText = "position:relative;display:block;height:100%;";

    // Parent container (scroll viewport)
    this.parent = document.createElement("div");
    this.parent.className = "dnd-parent";
    this.parent.style.cssText =
      "position:relative;overflow-y:auto;height:100%;";

    // Listbox
    this.listbox = document.createElement("div");
    this.listbox.setAttribute("role", "listbox");
    this.listbox.setAttribute("aria-multiselectable", "true");
    this.listbox.setAttribute("tabindex", "0");
    this.listbox.style.cssText = "position:relative;outline:none;";

    this.parent.appendChild(this.listbox);
    this.appendChild(this.parent);

    // Style element for rounded selection
    this.styleEl = document.createElement("style");
    this.appendChild(this.styleEl);
    this.updateRoundedSelectStyles();
  }

  // ── Rendering ───────────────────────────────────────────────────

  private renderList(): void {
    if (!this.source || !this.renderer) return;

    const order = this.source.getOrder();
    this.selection.updateOrder(order);

    // During drag, size the list to the collapsed layout (non-dragged items + nudge gap)
    // and render all non-dragged items (skip virtualization to avoid windowing mismatches)
    const dragSet = this.isDragging ? new Set(this.draggedKeys) : null;
    if (dragSet) {
      const visualCount = order.filter((k) => !dragSet.has(k)).length;
      const nudgeExtra = this.hoverIndex !== null && this.nudge ? 1 : 0;
      const contentHeight = this.virtualization.getTotalHeight(visualCount + nudgeExtra);
      this.listbox.style.height = `${Math.max(contentHeight, this.parent.clientHeight)}px`;
    } else {
      const contentHeight = this.virtualization.getTotalHeight(order.length);
      this.listbox.style.height = `${Math.max(contentHeight, this.parent.clientHeight)}px`;
    }

    // Calculate visible range
    const scrollTop = this.parent.scrollTop;
    const viewportHeight = this.parent.clientHeight;
    const newRange = dragSet
      ? { startIndex: 0, endIndex: order.length }
      : this.virtualization.calculateRange(scrollTop, viewportHeight, order.length);

    // Determine which keys should be rendered
    const keysToRender = new Set<Key>();
    for (let i = newRange.startIndex; i < newRange.endIndex; i++) {
      if (i < order.length) keysToRender.add(order[i]);
    }

    // Remove items no longer in range (but keep dragged items cached)
    for (const [key, item] of this.renderedItems) {
      if (!keysToRender.has(key) && !this.draggedKeys.includes(key)) {
        item.cleanup();
        item.element.remove();
        this.renderedItems.delete(key);
      }
    }

    // Add/update items in range
    const selectedKeys = new Set(this.selection.getSelectedKeys());

    for (let i = newRange.startIndex; i < newRange.endIndex; i++) {
      if (i >= order.length) break;
      const key = order[i];
      const existing = this.renderedItems.get(key);

      if (existing) {
        this.updateItemPosition(existing, i);
        this.updateItemSelection(existing, key, i, order, selectedKeys);
      } else {
        // Mount new item
        this.mountItem(key, i, order, selectedKeys);
      }
    }

    // Apply drag nudge if active (also resets positions when hoverIndex is null)
    if (this.isDragging && this.nudge) {
      this.applyNudge();
    }

    this.currentRange = newRange;
  }

  private mountItem(
    key: Key,
    index: number,
    order: readonly Key[],
    selectedKeys: Set<Key>,
  ): void {
    if (!this.renderer || !this.source) return;
    const item = this.source.getItem(key);
    if (item === undefined) return;

    const container = document.createElement("div");
    container.setAttribute("role", "option");
    container.dataset.key = String(key);
    container.style.cssText = `
      position:absolute;
      top:${this.virtualization.getItemTop(index)}px;
      left:0;right:0;
      height:${this.itemHeight}px;
      transition:top 0.15s ease;
    `;

    // Native drag mode
    if (this.dragType === "native") {
      container.draggable = true;
      container.addEventListener("dragstart", (e) =>
        this.onNativeDragStart(e, key),
      );
      container.addEventListener("dragend", () => this.onNativeDragEnd());
    }

    this.updateItemSelection(
      { element: container, cleanup: () => {}, index },
      key,
      index,
      order,
      selectedKeys,
    );

    const cleanup = this.renderer.mount(key, item, container);
    this.listbox.appendChild(container);
    this.renderedItems.set(key, { element: container, cleanup, index });
  }

  private updateItemPosition(item: RenderedItem, index: number): void {
    const newTop = this.virtualization.getItemTop(index);
    item.element.style.top = `${newTop}px`;
    item.index = index;
  }

  private updateItemSelection(
    item: RenderedItem,
    key: Key,
    index: number,
    order: readonly Key[],
    selectedKeys: Set<Key>,
  ): void {
    const isSelected = selectedKeys.has(key);
    item.element.setAttribute("aria-selected", String(isSelected));

    if (isSelected) {
      item.element.dataset.selected = "";

      if (this.roundedSelect) {
        const prevKey = index > 0 ? order[index - 1] : null;
        const nextKey =
          index < order.length - 1 ? order[index + 1] : null;
        const isFirst = !prevKey || !selectedKeys.has(prevKey);
        const isLast = !nextKey || !selectedKeys.has(nextKey);
        item.element.dataset.selFirst = isFirst ? "" : undefined!;
        item.element.dataset.selLast = isLast ? "" : undefined!;
        if (!isFirst) delete item.element.dataset.selFirst;
        if (!isLast) delete item.element.dataset.selLast;
      }
    } else {
      delete item.element.dataset.selected;
      delete item.element.dataset.selFirst;
      delete item.element.dataset.selLast;
    }

    // Hide dragged items in the list during drag
    if (this.isDragging && this.draggedKeys.includes(key)) {
      item.element.style.opacity = "0";
      item.element.style.pointerEvents = "none";
    } else {
      item.element.style.opacity = "";
      item.element.style.pointerEvents = "";
    }
  }

  private applyNudge(): void {
    const order = this.source!.getOrder();
    const dragSet = new Set(this.draggedKeys);
    const nudgeAmount = this.itemHeight;

    for (const [key, item] of this.renderedItems) {
      if (dragSet.has(key)) continue;
      const idx = order.indexOf(key);
      if (idx === -1) continue;

      // Count how many non-dragged items are before this index
      let visualIdx = 0;
      for (let i = 0; i < order.length && i <= idx; i++) {
        if (!dragSet.has(order[i])) visualIdx++;
      }
      visualIdx--; // 0-based

      const baseTop = visualIdx * this.itemHeight;
      if (this.hoverIndex !== null && visualIdx >= this.hoverIndex) {
        item.element.style.top = `${baseTop + nudgeAmount}px`;
      } else {
        item.element.style.top = `${baseTop}px`;
      }
    }
  }

  private clearAllItems(): void {
    for (const [, item] of this.renderedItems) {
      item.cleanup();
      item.element.remove();
    }
    this.renderedItems.clear();
  }

  private updateRoundedSelectStyles(): void {
    const base = `[data-selected] { background: var(--dnd-select-bg, transparent); }`;
    if (!this.roundedSelect) {
      this.styleEl.textContent = base;
      return;
    }
    this.styleEl.textContent = `
      ${base}
      [data-sel-first] { border-top-left-radius: 4px; border-top-right-radius: 4px; }
      [data-sel-last] { border-bottom-left-radius: 4px; border-bottom-right-radius: 4px; }
    `;
  }

  // ── Scroll ──────────────────────────────────────────────────────

  private onScroll = (): void => {
    this.renderList();

    // Recalculate hover index and placeholder during drag (scrollTop changed)
    if (this.isDragging) {
      this.updateHoverIndex();
      this.updatePlaceholder();
      if (this.nudge) this.applyNudge();
    }
  };

  /** Smoothly scroll to bring a key into view. */
  private scrollToKey(key: Key): void {
    if (!this.source) return;
    const order = this.source.getOrder();
    const idx = order.indexOf(key);
    if (idx === -1) return;

    const offset = this.virtualization.getScrollToOffset(
      idx,
      this.parent.scrollTop,
      this.parent.clientHeight,
    );
    if (offset !== null) {
      this.smoothScrollTo(offset);
    }
  }

  private smoothScrollTo(target: number): void {
    if (this.scrollRaf !== null) cancelAnimationFrame(this.scrollRaf);
    const step = () => {
      const diff = target - this.parent.scrollTop;
      if (Math.abs(diff) < 1) {
        this.parent.scrollTop = target;
        this.scrollRaf = null;
        return;
      }
      this.parent.scrollTop += diff * 0.35;
      this.scrollRaf = requestAnimationFrame(step);
    };
    this.scrollRaf = requestAnimationFrame(step);
  }

  // ── Keyboard ────────────────────────────────────────────────────

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.source) return;
    const action = mapDndKeyEvent(e);
    if (action.type === "ignore") return;

    e.preventDefault();
    const order = this.source.getOrder();

    switch (action.type) {
      case "select-only-first":
        this.selection.selectOnly(this.selection.first());
        this.scrollToKey(this.selection.first());
        break;

      case "select-only-last":
        this.selection.selectOnly(this.selection.last());
        this.scrollToKey(this.selection.last());
        break;

      case "navigate": {
        if (!this.selection.hasSelection()) {
          const key =
            action.direction === "down"
              ? order[0]
              : order[order.length - 1];
          if (key !== undefined) {
            this.selection.selectOnly(key);
            this.scrollToKey(key);
          }
        } else {
          const ref =
            action.direction === "down"
              ? this.selection.getSelectionBottom()
              : this.selection.getSelectionTop();
          if (ref !== null) {
            const target =
              action.direction === "down"
                ? this.selection.next(ref)
                : this.selection.prev(ref);
            this.selection.selectOnly(target);
            this.scrollToKey(target);
          }
        }
        break;
      }

      case "extend": {
        const activeBlock = this.selection.getActiveBlock();
        if (activeBlock !== null) {
          const target =
            action.direction === "down"
              ? this.selection.next(activeBlock.to)
              : this.selection.prev(activeBlock.to);
          this.selection.extendActive(target);
          this.scrollToKey(target);
        } else {
          // No active — start from first/last
          const key =
            action.direction === "down" ? order[0] : order[order.length - 1];
          if (key !== undefined) {
            this.selection.selectOnly(key);
            this.scrollToKey(key);
          }
        }
        break;
      }

      case "extend-to-first":
        this.selection.extendActive(this.selection.first());
        this.scrollToKey(this.selection.first());
        break;

      case "extend-to-last":
        this.selection.extendActive(this.selection.last());
        this.scrollToKey(this.selection.last());
        break;

      case "move-selection":
        this.handleMoveSelection(action.direction);
        break;

      case "clear":
        this.selection.clear();
        break;
    }

    this.renderList();
  };

  private handleMoveSelection(dir: "up" | "down"): void {
    if (!this.source || !this.selection.hasSelection()) return;

    const selectedKeys = this.selection.getSelectedKeys();
    const order = this.source.getOrder();

    // Calculate where to move
    const keySet = new Set(selectedKeys);
    const filtered = order.filter((k) => !keySet.has(k));

    // Find insertion point
    const topKey = this.selection.getSelectionTop()!;
    const topIdx = order.indexOf(topKey);
    const bottomKey = this.selection.getSelectionBottom()!;
    const bottomIdx = order.indexOf(bottomKey);

    let beforeKey: Key | null;
    if (dir === "up") {
      if (topIdx <= 0) return;
      // Find the key that was just above the selection
      const aboveKey = order[topIdx - 1];
      if (keySet.has(aboveKey)) return;
      const aboveIdxInFiltered = filtered.indexOf(aboveKey);
      beforeKey = aboveIdxInFiltered >= 0 ? filtered[aboveIdxInFiltered] : null;
    } else {
      if (bottomIdx >= order.length - 1) return;
      const belowKey = order[bottomIdx + 1];
      if (keySet.has(belowKey)) return;
      const belowIdxInFiltered = filtered.indexOf(belowKey);
      beforeKey =
        belowIdxInFiltered + 1 < filtered.length
          ? filtered[belowIdxInFiltered + 1]
          : null;
    }

    const txnId = this.source.apply([
      { type: "move", keys: selectedKeys, beforeKey },
    ]);
    this.source._commitUI(txnId);
    this.source._commitState(txnId);

    // Update selection to new positions
    this.selection.updateOrder(this.source.getOrder());

    // Scroll to the leading edge of the moved selection
    const scrollTarget =
      dir === "up"
        ? this.selection.getSelectionTop()
        : this.selection.getSelectionBottom();
    if (scrollTarget !== null) this.scrollToKey(scrollTarget);
  }

  // ── Mouse ───────────────────────────────────────────────────────

  private onClick = (e: MouseEvent): void => {
    if (!this.source) return;

    const key = this.getKeyFromEvent(e);
    if (key === null) return;

    const isMac =
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
    const modKey = isMac ? e.metaKey : e.ctrlKey;

    if (e.shiftKey) {
      this.selection.extendActive(key);
    } else if (modKey) {
      this.selection.toggleItem(key);
    } else if (!this.isDragging) {
      this.selection.selectOnly(key);
    }

    this.renderList();
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (!this.source || e.button !== 0) return;
    if (this.dragType === "native") return; // native drag handles itself

    // Shift/cmd clicks are handled entirely by onClick
    const isMac =
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
    const modKey = isMac ? e.metaKey : e.ctrlKey;
    if (e.shiftKey || modKey) return;

    const key = this.getKeyFromEvent(e);
    if (key === null) return;

    // If unselected, select it first
    if (!this.selection.isSelected(key)) {
      this.selection.selectOnly(key);
      this.renderList();
    }

    this.mouseDownPos = { x: e.clientX, y: e.clientY };
    this.mouseDownKey = key;

    document.addEventListener("mousemove", this.onDocMouseMove);
    document.addEventListener("mouseup", this.onDocMouseUp);
  };

  private onDocMouseMove = (e: MouseEvent): void => {
    if (!this.mouseDownPos || !this.source) return;

    if (!this.isDragging) {
      const dx = e.clientX - this.mouseDownPos.x;
      const dy = e.clientY - this.mouseDownPos.y;
      if (Math.sqrt(dx * dx + dy * dy) < DRAG_BUFFER_PX) return;

      // Start drag
      this.startOverlayDrag(e.clientX, e.clientY);
    }

    // Update drag
    this.lastPointerPos = { x: e.clientX, y: e.clientY };
    this.dragOverlay.updatePosition(e.clientX, e.clientY);
    this.autoscroll.confine = this.confineAutoscroll;
    this.autoscroll.update(e.clientX, e.clientY);

    this.updateHoverIndex();
    this.updatePlaceholder();
    if (this.nudge) this.applyNudge();
  };

  private onDocMouseUp = (e: MouseEvent): void => {
    document.removeEventListener("mousemove", this.onDocMouseMove);
    document.removeEventListener("mouseup", this.onDocMouseUp);

    if (this.isDragging) {
      this.endDrag();
    }

    this.mouseDownPos = null;
    this.mouseDownKey = null;
  };

  private startOverlayDrag(x: number, y: number): void {
    this.isDragging = true;
    this.listbox.style.overflow = "hidden";
    this.draggedKeys = this.selection.getSelectedKeys();

    // Collect rendered elements for the stack
    const elements: HTMLElement[] = [];
    let grabElement: HTMLElement | null = null;
    for (const key of this.draggedKeys) {
      const item = this.renderedItems.get(key);
      if (item) {
        elements.push(item.element);
        if (key === this.mouseDownKey) grabElement = item.element;
      }
    }

    this.dragOverlay.start(
      elements,
      this.draggedKeys.length,
      x,
      y,
      this.itemHeight,
      this.listbox.clientWidth,
      grabElement ?? elements[0],
    );
    this.renderList(); // Re-render to hide dragged items

    // Clamp scroll position once to fit collapsed layout
    const order = this.source!.getOrder();
    const dragSet = new Set(this.draggedKeys);
    const visualCount = order.filter((k) => !dragSet.has(k)).length;
    const listHeight = Math.max(
      this.virtualization.getTotalHeight(visualCount),
      this.parent.clientHeight,
    );
    const maxScroll = listHeight - this.parent.clientHeight;
    if (this.parent.scrollTop > maxScroll) {
      this.parent.scrollTop = Math.max(0, maxScroll);
    }
  }

  private endDrag(): void {
    this.dragOverlay.stop();
    this.autoscroll.stop();
    this.canvas.clear();

    if (this.hoverIndex !== null && this.source) {
      // Compute the beforeKey from hoverIndex
      const order = this.source.getOrder();
      const dragSet = new Set(this.draggedKeys);
      const filtered = order.filter((k) => !dragSet.has(k));
      const beforeKey =
        this.hoverIndex < filtered.length
          ? filtered[this.hoverIndex]
          : null;

      const txnId = this.source.apply([
        { type: "move", keys: this.draggedKeys, beforeKey },
      ]);
      this.source._commitUI(txnId);
      this.source._commitState(txnId);
    }

    // Remove dragged items from DOM so renderList() re-mounts them
    // at their new position — no stale top value to transition from.
    for (const key of this.draggedKeys) {
      const item = this.renderedItems.get(key);
      if (item) {
        item.cleanup();
        item.element.remove();
        this.renderedItems.delete(key);
      }
    }

    this.isDragging = false;
    this.hoverIndex = null;
    this.lastPointerPos = null;
    this.draggedKeys = [];
    this.listbox.style.overflow = "";
    this.renderList();
  }

  // ── Native drag ─────────────────────────────────────────────────

  private onNativeDragStart = (e: DragEvent, key: Key): void => {
    if (!this.source || !this.renderer) return;

    // Ensure item is selected
    if (!this.selection.isSelected(key)) {
      this.selection.selectOnly(key);
    }

    this.isDragging = true;
    this.draggedKeys = this.selection.getSelectedKeys();

    if (!this.dragNative) {
      this.dragNative = new DndDragNative(this.renderer);
    }

    const items = this.draggedKeys
      .map((k) => this.source!.getItem(k))
      .filter((i) => i !== undefined);
    this.dragNative.onDragStart(e, this.draggedKeys, items);

    // Listen for dragover/drop on listbox
    this.listbox.addEventListener("dragover", this.onNativeDragOver);
    this.listbox.addEventListener("drop", this.onNativeDrop);
    this.listbox.addEventListener("dragleave", this.onNativeDragLeave);

    this.renderList();
  };

  private onNativeDragOver = (e: DragEvent): void => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";

    const rect = this.parent.getBoundingClientRect();
    const y = e.clientY - rect.top + this.parent.scrollTop;
    const order = this.source!.getOrder();
    this.hoverIndex = this.virtualization.getIndexAtY(y, order.length + 1);

    this.autoscroll.update(e.clientX, e.clientY);
    this.updatePlaceholder();
    if (this.nudge) this.applyNudge();
  };

  private onNativeDragLeave = (): void => {
    this.hoverIndex = null;
    this.canvas.clear();
  };

  private onNativeDrop = (e: DragEvent): void => {
    e.preventDefault();
    this.endDrag();
  };

  private onNativeDragEnd = (): void => {
    this.listbox.removeEventListener("dragover", this.onNativeDragOver);
    this.listbox.removeEventListener("drop", this.onNativeDrop);
    this.listbox.removeEventListener("dragleave", this.onNativeDragLeave);

    if (this.dragNative) this.dragNative.onDragEnd();
    this.autoscroll.stop();

    if (this.isDragging) {
      // Drag cancelled (e.g. escape or dropped outside)
      this.isDragging = false;
      this.hoverIndex = null;
      this.draggedKeys = [];
      this.listbox.style.overflow = "";
      this.canvas.clear();
      this.renderList();
    }
  };

  // ── Touch ───────────────────────────────────────────────────────

  private onTouchStart = (e: TouchEvent): void => {
    if (!this.source) return;
    const key = this.getKeyFromTouchEvent(e);
    if (key === null) return;

    const t = e.touches[0];
    this.touch.onTouchStart(key, t.clientX, t.clientY);
  };

  private onTouchMove = (e: TouchEvent): void => {
    const t = e.touches[0];
    const result = this.touch.onTouchMove(t.clientX, t.clientY);

    switch (result.type) {
      case "drag-start":
        e.preventDefault();
        if (!this.selection.isSelected(result.key)) {
          this.selection.selectOnly(result.key);
        }
        this.startOverlayDrag(result.x, result.y);
        break;

      case "dragging":
        e.preventDefault();
        this.dragOverlay.updatePosition(result.x, result.y);
        this.autoscroll.update(result.x, result.y);

        // Update hover index
        if (this.source) {
          const rect = this.parent.getBoundingClientRect();
          if (
            result.x >= rect.left &&
            result.x <= rect.right &&
            result.y >= rect.top &&
            result.y <= rect.bottom
          ) {
            const y = result.y - rect.top + this.parent.scrollTop;
            this.hoverIndex = this.virtualization.getIndexAtY(
              y,
              this.source.getOrder().length,
            );
          } else {
            this.hoverIndex = null;
          }
          this.updatePlaceholder();
          if (this.nudge) this.applyNudge();
        }
        break;

      case "scroll":
        // Let default scroll happen
        break;
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    const t = e.changedTouches[0];
    const result = this.touch.onTouchEnd(t.clientX, t.clientY);

    switch (result.type) {
      case "select":
        this.selection.selectOnly(result.key);
        this.renderList();
        break;

      case "drag-end":
        this.endDrag();
        break;
    }
  };

  // ── Placeholder ─────────────────────────────────────────────────

  private updateHoverIndex(): void {
    if (!this.source || !this.lastPointerPos) return;
    const rect = this.parent.getBoundingClientRect();
    const { x, y } = this.lastPointerPos;
    if (
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom
    ) {
      const scrollY = y - rect.top + this.parent.scrollTop;
      const order = this.source.getOrder();
      const dragSet = new Set(this.draggedKeys);
      const nonDragCount = order.filter((k) => !dragSet.has(k)).length;
      this.hoverIndex = Math.max(
        0,
        Math.min(
          Math.floor(scrollY / this.itemHeight),
          nonDragCount,
        ),
      );
    } else {
      this.hoverIndex = null;
    }
  }

  private updatePlaceholder(): void {
    if (this.hoverIndex === null) {
      this.canvas.clear();
      return;
    }

    const y = this.hoverIndex * this.itemHeight - this.parent.scrollTop;
    this.canvas.renderPlaceholder(y);
  }

  // ── Helpers ─────────────────────────────────────────────────────

  private getKeyFromEvent(e: MouseEvent): Key | null {
    const target = e.target as HTMLElement;
    const option = target.closest<HTMLElement>("[role=option]");
    if (!option || option.dataset.key === undefined) return null;
    return option.dataset.key;
  }

  private getKeyFromTouchEvent(e: TouchEvent): Key | null {
    const target = e.target as HTMLElement;
    const option = target.closest<HTMLElement>("[role=option]");
    if (!option || option.dataset.key === undefined) return null;
    return option.dataset.key;
  }

  private cleanup(): void {
    this.parent?.removeEventListener("scroll", this.onScroll);
    this.listbox?.removeEventListener("keydown", this.onKeyDown);
    this.listbox?.removeEventListener("mousedown", this.onMouseDown);
    this.listbox?.removeEventListener("click", this.onClick);
    this.listbox?.removeEventListener("touchstart", this.onTouchStart);
    this.listbox?.removeEventListener("touchmove", this.onTouchMove);
    this.listbox?.removeEventListener("touchend", this.onTouchEnd);
    document.removeEventListener("mousemove", this.onDocMouseMove);
    document.removeEventListener("mouseup", this.onDocMouseUp);
    this.resizeObserver?.disconnect();
    this.autoscroll?.stop();
    if (this.scrollRaf !== null) cancelAnimationFrame(this.scrollRaf);
    this.dragOverlay?.stop();
    this.touch?.cancel();
    if (this.sourceUnsub) this.sourceUnsub();
    this.clearAllItems();
  }
}
