/**
 * that follow the cursor with increasing lag per depth level.
 */
export class DndDragOverlay {
  private overlay: HTMLElement | null = null;
  private stackEls: HTMLElement[] = [];
  private countBadge: HTMLElement | null = null;
  private positions: { x: number; y: number }[] = [];
  private targetPos = { x: 0, y: 0 };
  private raf: number | null = null;
  private active = false;

  constructor(private stackCount: number) {}

  /**
   * Create the overlay and clone the first N selected item elements.
   * @param elements - The selected item DOM elements (first stackCount used)
   * @param totalCount - Total number of dragged items (for badge)
   * @param startX - Initial cursor X
   * @param startY - Initial cursor Y
   * @param itemHeight - Height of a single item row
   * @param listWidth - Width of the list container
   */
  start(
    elements: HTMLElement[],
    totalCount: number,
    startX: number,
    startY: number,
    itemHeight: number,
    listWidth: number,
  ): void {
    this.active = true;
    this.targetPos = { x: startX, y: startY };

    // Create full-page overlay
    this.overlay = document.createElement("div");
    this.overlay.style.cssText =
      "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;";
    document.body.appendChild(this.overlay);

    // Clone items into stack, each wrapped in a sized container
    const count = Math.min(elements.length, this.stackCount);
    this.stackEls = [];
    this.positions = [];

    // Resolve background from the first element's computed style (since
    // the overlay is appended to <body>, CSS vars from the component won't cascade)
    const resolvedBg =
      elements.length > 0
        ? getComputedStyle(elements[0]).backgroundColor
        : "#fff";

    for (let i = 0; i < count; i++) {
      const clone = elements[i].cloneNode(true) as HTMLElement;
      clone.style.position = "relative";
      clone.style.top = "0";
      clone.style.left = "0";
      clone.style.right = "auto";
      clone.style.transition = "none";

      const wrapper = document.createElement("div");
      const offset = i * 2;
      wrapper.style.cssText = `
        position:absolute;
        pointer-events:none;
        opacity:${1 - i * 0.1};
        z-index:${this.stackCount - i};
        transform:translate(${offset}px, ${offset}px);
        width:${listWidth}px;
        height:${itemHeight}px;
        background:${resolvedBg};
        box-shadow:var(--dnd-drag-shadow, 0 0 0 1px color-mix(in oklab,#0000330f,#f0f0f3 25%),0 12px 60px #00000026,0 12px 32px -16px #0009321f);
        overflow:hidden;
      `;

      wrapper.appendChild(clone);
      this.overlay.appendChild(wrapper);
      this.stackEls.push(wrapper);
      this.positions.push({ x: startX, y: startY });
    }

    // Count badge
    if (totalCount > 1) {
      this.countBadge = document.createElement("div");
      this.countBadge.textContent = String(totalCount);
      this.countBadge.style.cssText = `
        position:absolute;
        top:-8px;right:-8px;
        min-width:20px;height:20px;
        border-radius:10px;
        background:#3b82f6;color:#fff;
        font-size:12px;font-weight:600;
        display:flex;align-items:center;justify-content:center;
        padding:0 5px;
        z-index:${this.stackCount + 1};
      `;
      this.stackEls[0].style.position = "relative";
      this.stackEls[0].appendChild(this.countBadge);
    }

    this.animate();
  }

  /** Update cursor target position. */
  updatePosition(x: number, y: number): void {
    this.targetPos = { x, y };
  }

  /** Tear down overlay and cancel animation. */
  stop(): void {
    this.active = false;
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this.stackEls = [];
    this.countBadge = null;
    this.positions = [];
  }

  isActive(): boolean {
    return this.active;
  }

  private animate = (): void => {
    if (!this.active) return;

    for (let i = 0; i < this.positions.length; i++) {
      // Each deeper level lerps toward the previous level's position
      // with increasing lag, creating a trailing effect
      const target =
        i === 0 ? this.targetPos : this.positions[i - 1];

      const factor = i === 0 ? 0.8 : 0.6 - i * 0.03;
      const clampedFactor = Math.max(factor, 0.4);

      this.positions[i] = {
        x: this.positions[i].x + (target.x - this.positions[i].x) * clampedFactor,
        y: this.positions[i].y + (target.y - this.positions[i].y) * clampedFactor,
      };

      const el = this.stackEls[i];
      if (el) {
        const offset = i * 2;
        el.style.left = `${this.positions[i].x + offset}px`;
        el.style.top = `${this.positions[i].y + offset}px`;
      }
    }

    this.raf = requestAnimationFrame(this.animate);
  };
}
