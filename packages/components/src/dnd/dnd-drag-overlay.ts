/**
 * Overlay drag mode: full-page overlay with stacked item clones
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

  constructor(
    private stackCount: number,
    private lagPerDepth = 30,
  ) {}

  /**
   * Create the overlay and clone the first N selected item elements.
   * @param elements - The selected item DOM elements (first stackCount used)
   * @param totalCount - Total number of dragged items (for badge)
   * @param startX - Initial cursor X
   * @param startY - Initial cursor Y
   */
  start(
    elements: HTMLElement[],
    totalCount: number,
    startX: number,
    startY: number,
  ): void {
    this.active = true;
    this.targetPos = { x: startX, y: startY };

    // Create full-page overlay
    this.overlay = document.createElement("div");
    this.overlay.style.cssText =
      "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;";
    document.body.appendChild(this.overlay);

    // Clone items into stack
    const count = Math.min(elements.length, this.stackCount);
    this.stackEls = [];
    this.positions = [];

    for (let i = 0; i < count; i++) {
      const clone = elements[i].cloneNode(true) as HTMLElement;
      const offset = i * 2;
      clone.style.cssText = `
        position:absolute;
        pointer-events:none;
        opacity:${1 - i * 0.1};
        z-index:${this.stackCount - i};
        transform:translate(${offset}px, ${offset}px);
        transition:none;
      `;
      // Copy computed width
      const rect = elements[i].getBoundingClientRect();
      clone.style.width = `${rect.width}px`;
      clone.style.height = `${rect.height}px`;

      this.overlay.appendChild(clone);
      this.stackEls.push(clone);
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
      const factor = 0.3 - i * 0.05; // decreasing responsiveness
      const clampedFactor = Math.max(factor, 0.08);

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
