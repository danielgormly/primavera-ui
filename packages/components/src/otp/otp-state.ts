export type OTPMode = "numeric" | "alphanumeric";

const NUMERIC_RE = /^[0-9]$/;
const ALPHANUM_RE = /^[a-zA-Z0-9]$/;

export class OTPState {
  value = "";

  constructor(
    public readonly length: number,
    public readonly mode: OTPMode = "numeric",
  ) {}

  isValidChar(ch: string): boolean {
    return this.mode === "numeric" ? NUMERIC_RE.test(ch) : ALPHANUM_RE.test(ch);
  }

  /** Insert/replace char at position. Returns new value. */
  insert(pos: number, char: string): string {
    if (pos < 0 || pos >= this.length) return this.value;
    if (!this.isValidChar(char)) return this.value;

    // Pad value to reach position if needed
    const padded = this.value.padEnd(pos, "\0").split("");
    padded[pos] = char;

    // Remove any null padding holes — keep contiguous from start
    this.value = padded.join("").replace(/\0/g, "").slice(0, this.length);
    return this.value;
  }

  /** Delete char at position; subsequent chars shift left. Returns new value. */
  deleteAt(pos: number): string {
    if (pos < 0 || pos >= this.value.length) return this.value;
    this.value = this.value.slice(0, pos) + this.value.slice(pos + 1);
    return this.value;
  }

  /** Paste text starting at position. Returns new value and end cursor position. */
  paste(pos: number, text: string): { value: string; endPos: number } {
    const chars = [...text].filter((ch) => this.isValidChar(ch));
    const available = this.length - pos;
    const toInsert = chars.slice(0, available);

    if (toInsert.length === 0) return { value: this.value, endPos: pos };

    const before = this.value.slice(0, pos);
    const after = this.value.slice(pos + toInsert.length);
    this.value = (before + toInsert.join("") + after).slice(0, this.length);

    const endPos = Math.min(pos + toInsert.length - 1, this.length - 1);
    return { value: this.value, endPos };
  }

  /** Clear all. Returns empty string. */
  clear(): string {
    this.value = "";
    return this.value;
  }

  isComplete(): boolean {
    return this.value.length === this.length;
  }

  charAt(pos: number): string {
    return pos < this.value.length ? this.value[pos] : "";
  }
}
