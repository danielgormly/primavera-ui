/**
 * <primavera-otp-input> — Single OTP digit input. No Shadow DOM.
 *
 * Renders a plain <input type="text"> with no maxlength.
 * All keyboard/input logic is handled by the parent <primavera-otp> container;
 * this element is intentionally minimal.
 */
export class PrimaveraOtpInput extends HTMLElement {
  input!: HTMLInputElement;

  /** Positional index within the OTP group (set by parent container). */
  index = 0;

  connectedCallback() {
    if (this.input) return; // already initialised

    // Adopt a pre-rendered <input> if present (SSR), otherwise create one
    const existing = this.querySelector("input");
    if (existing) {
      this.input = existing;
      return;
    }

    const input = document.createElement("input");
    input.type = "text";
    // No maxlength — OS autofill needs to dump the full code into one input.
    // The container's onInput handler distributes multi-char values across slots.
    input.size = 1;
    input.setAttribute("aria-label", `Digit ${this.index + 1}`);

    this.input = input;
    this.appendChild(input);
  }

  /** Update the aria-label once the parent knows the total count. */
  setPosition(index: number, total: number) {
    this.index = index;
    this.input.setAttribute("aria-label", `Digit ${index + 1} of ${total}`);
  }

  /** Configure input based on parent's mode. */
  setMode(mode: "numeric" | "alphanumeric") {
    if (mode === "numeric") {
      this.input.inputMode = "numeric";
      this.input.pattern = "[0-9]";
    } else {
      this.input.removeAttribute("inputmode");
      this.input.removeAttribute("pattern");
    }
  }

  setAutocomplete(value: string) {
    if (value) {
      this.input.autocomplete = value as AutoFill;
    } else {
      this.input.removeAttribute("autocomplete");
    }
  }

  setReadOnly(readOnly: boolean) {
    this.input.readOnly = readOnly;
    if (readOnly) {
      this.input.setAttribute("aria-readonly", "true");
    } else {
      this.input.removeAttribute("aria-readonly");
    }
  }

  setValue(char: string) {
    this.input.value = char;
  }

  focus() {
    this.input.focus();
  }

  selectContent() {
    this.input.select();
  }
}
