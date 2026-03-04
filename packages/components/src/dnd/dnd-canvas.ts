/**
 * Renders a drop-position placeholder on a canvas that sits behind the list.
 * Using canvas avoids DOM reflow and keeps animations smooth.
 */
export class DndCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(
    private color = "var(--dnd-placeholder-color, #3b82f6)",
    private lineHeight = 2,
  ) {
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText =
      "position:absolute;top:0;left:0;pointer-events:none;z-index:1;";
    this.ctx = this.canvas.getContext("2d")!;
  }

  getElement(): HTMLCanvasElement {
    return this.canvas;
  }

  /** Sync canvas bitmap size to its layout size. Call on resize. */
  resize(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  /**
   * Draw a placeholder line at the position where a drop would insert.
   * @param y - Y position in viewport-relative pixels (already accounting for scrollTop).
   *            Pass null to clear.
   */
  renderPlaceholder(y: number | null): void {
    this.clear();
    if (y === null) return;

    // Resolve CSS variable at draw time
    const style = getComputedStyle(this.canvas);
    const resolved =
      style.getPropertyValue("--dnd-placeholder-color").trim() || this.color;

    this.ctx.fillStyle = resolved;
    const canvasW = this.canvas.width / (window.devicePixelRatio || 1);
    this.ctx.fillRect(0, y - this.lineHeight / 2, canvasW, this.lineHeight);
  }

  clear(): void {
    const dpr = window.devicePixelRatio || 1;
    this.ctx.clearRect(
      0,
      0,
      this.canvas.width / dpr,
      this.canvas.height / dpr,
    );
  }
}
