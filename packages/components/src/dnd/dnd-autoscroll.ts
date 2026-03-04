/**
 * Autoscroll controller: scrolls the list container when drag cursor
 * approaches the top or bottom edge.
 */
export class DndAutoscroll {
  private direction: "up" | "down" | null = null;
  private startTime = 0;
  private raf: number | null = null;
  private maxSpeed: number;
  private accelerationMs: number;

  constructor(
    private container: HTMLElement,
    private buffer: number,
    private confine: boolean,
    maxSpeed = 12,
    accelerationMs = 2000,
  ) {
    this.maxSpeed = maxSpeed;
    this.accelerationMs = accelerationMs;
  }

  /**
   * Call on every mousemove/touchmove during drag.
   * @param clientX - Mouse X in viewport coords
   * @param clientY - Mouse Y in viewport coords
   */
  update(clientX: number, clientY: number): void {
    const rect = this.container.getBoundingClientRect();

    // Check x-bounds — stop if cursor leaves horizontal bounds
    if (clientX < rect.left || clientX > rect.right) {
      this.stop();
      return;
    }

    // Confine mode: stop if cursor leaves y-bounds entirely
    if (this.confine && (clientY < rect.top || clientY > rect.bottom)) {
      this.stop();
      return;
    }

    const topZone = rect.top + this.buffer;
    const bottomZone = rect.bottom - this.buffer;

    if (clientY < topZone && clientY >= rect.top) {
      this.startScroll("up");
    } else if (clientY > bottomZone && clientY <= rect.bottom) {
      this.startScroll("down");
    } else {
      this.stop();
    }
  }

  stop(): void {
    this.direction = null;
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }

  private startScroll(dir: "up" | "down"): void {
    if (this.direction === dir) return; // already scrolling this direction
    this.direction = dir;
    this.startTime = performance.now();
    if (this.raf === null) {
      this.tick();
    }
  }

  private tick = (): void => {
    if (this.direction === null) return;

    const elapsed = performance.now() - this.startTime;
    const t = Math.min(elapsed / this.accelerationMs, 1);
    // Ease-in acceleration curve
    const speed = this.maxSpeed * t * t;
    const delta = this.direction === "up" ? -speed : speed;

    this.container.scrollTop += delta;
    this.raf = requestAnimationFrame(this.tick);
  };
}
