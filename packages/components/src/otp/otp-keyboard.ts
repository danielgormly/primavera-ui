export type OTPAction =
  | { type: "insert"; char: string }
  | { type: "delete" }
  | { type: "clear" }
  | { type: "move-next" }
  | { type: "move-prev" }
  | { type: "submit" }
  | { type: "ignore" };

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Maps a KeyboardEvent to a semantic OTP action.
 * Pure function — no DOM side effects.
 */
export function mapKeyEvent(e: KeyboardEvent): OTPAction {
  const mod = isMac ? e.metaKey : e.ctrlKey;

  // Clear all: Cmd+Backspace (mac) / Ctrl+Backspace (win)
  if (mod && (e.key === "Backspace" || e.key === "Delete")) {
    return { type: "clear" };
  }

  if (e.key === "Backspace" || e.key === "Delete") {
    return { type: "delete" };
  }

  if (e.key === "ArrowRight") return { type: "move-next" };
  if (e.key === "ArrowLeft") return { type: "move-prev" };
  if (e.key === "Enter") return { type: "submit" };

  // Tab — let it pass through (single tab stop)
  if (e.key === "Tab") return { type: "ignore" };

  // Ignore modifier combos (Ctrl+C, etc.) except plain typing
  if (e.ctrlKey || e.metaKey || e.altKey) return { type: "ignore" };

  // Single printable character
  if (e.key.length === 1) {
    return { type: "insert", char: e.key };
  }

  return { type: "ignore" };
}
