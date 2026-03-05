import { OTPState } from "./otp-state";
import { mapKeyEvent } from "./otp-keyboard";
import type { PrimaveraOtpInput } from "./otp-input";

/**
 * <primavera-otp> — OTP input container. No Shadow DOM.
 *
 * Orchestrates state, focus management, keyboard handling, accessibility,
 * and event dispatch across child <primavera-otp-input> elements.
 */
export class PrimaveraOtp extends HTMLElement {
  private state!: OTPState;
  private inputs: PrimaveraOtpInput[] = [];
  private hiddenInput: HTMLInputElement | null = null;
  private initialized = false;

  // ── attribute helpers ──────────────────────────────────────────────

  private get mode() {
    return (
      (this.getAttribute("mode") as "numeric" | "alphanumeric") || "numeric"
    );
  }

  private get order() {
    return (this.getAttribute("order") as "ltr" | "rtl") || "ltr";
  }

  private get isRtl() {
    return this.order === "rtl";
  }

  private get autoSubmit() {
    return this.hasAttribute("auto-submit");
  }

  private get readOnly() {
    return this.hasAttribute("read-only");
  }

  private get shouldAutofocus() {
    return this.hasAttribute("autofocus");
  }

  private get label() {
    return this.getAttribute("label") || "Verification code";
  }

  private get name() {
    return this.getAttribute("name");
  }

  private get autocompleteValue() {
    return this.getAttribute("autocomplete") || "one-time-code";
  }

  // ── observed attributes ────────────────────────────────────────────

  static get observedAttributes() {
    return ["read-only", "error", "mode", "label"];
  }

  attributeChangedCallback(
    name: string,
    _old: string | null,
    val: string | null,
  ) {
    if (!this.initialized) return;

    switch (name) {
      case "read-only":
        this.inputs.forEach((i) => i.setReadOnly(val !== null));
        break;
      case "error":
        if (val !== null) {
          this.setAttribute("aria-invalid", "true");
          this.dataset.error = "";
        } else {
          this.removeAttribute("aria-invalid");
          delete this.dataset.error;
        }
        break;
      case "mode":
        this.state = new OTPState(this.inputs.length, this.mode);
        this.inputs.forEach((i) => i.setMode(this.mode));
        this.syncDisplay();
        break;
      case "label":
        this.setAttribute("aria-label", this.label);
        break;
    }
  }

  // ── lifecycle ──────────────────────────────────────────────────────

  connectedCallback() {
    if (this.initialized) return;

    // Wait for child <primavera-otp-input> elements to be upgraded.
    // When parsed from HTML, children's connectedCallback may not have
    // fired yet, so we defer initialisation to the next microtask.
    customElements.whenDefined("primavera-otp-input").then(() => {
      // Double-check in case disconnectedCallback ran in the meantime
      if (!this.isConnected || this.initialized) return;
      this.init();
    });
  }

  private init() {
    // Discover child <primavera-otp-input> elements
    this.inputs = Array.from(
      this.querySelectorAll<PrimaveraOtpInput>("primavera-otp-input"),
    );

    if (this.inputs.length === 0) {
      console.warn("<primavera-otp>: no <primavera-otp-input> children found.");
      return;
    }

    // Ensure children have created their inner <input> elements
    this.inputs.forEach((slot) => {
      if (!slot.input) slot.connectedCallback();
    });

    this.state = new OTPState(this.inputs.length, this.mode);

    // Configure each child
    this.inputs.forEach((slot, i) => {
      slot.setPosition(i, this.inputs.length);
      slot.setMode(this.mode);
      slot.setReadOnly(this.readOnly);
      // autocomplete="one-time-code" on first input only — triggers OS autofill
      slot.setAutocomplete(i === 0 ? this.autocompleteValue : "");
    });

    // ARIA on container
    this.setAttribute("role", "group");
    this.setAttribute("aria-label", this.label);

    // Error attribute (initial)
    if (this.hasAttribute("error")) {
      this.setAttribute("aria-invalid", "true");
      this.dataset.error = "";
    }

    // Hidden input for form participation
    if (this.name) {
      this.hiddenInput = document.createElement("input");
      this.hiddenInput.type = "hidden";
      this.hiddenInput.name = this.name;
      this.hiddenInput.autocomplete = this.autocompleteValue as AutoFill;
      this.appendChild(this.hiddenInput);
    }

    // Tab management: only first input is tabbable
    this.inputs.forEach((slot, i) => {
      slot.input.tabIndex = i === 0 ? 0 : -1;
    });

    // Event listeners (delegate from container)
    this.addEventListener("keydown", this.onKeyDown);
    this.addEventListener("input", this.onInput);
    this.addEventListener("paste", this.onPaste);
    this.addEventListener("click", this.onClick);
    this.addEventListener("focusin", this.onFocusIn);

    this.initialized = true;

    if (this.shouldAutofocus) {
      queueMicrotask(() => this.focusIndex(0));
    }
  }

  disconnectedCallback() {
    this.removeEventListener("keydown", this.onKeyDown);
    this.removeEventListener("input", this.onInput);
    this.removeEventListener("paste", this.onPaste);
    this.removeEventListener("click", this.onClick);
    this.removeEventListener("focusin", this.onFocusIn);
  }

  // ── event handlers ─────────────────────────────────────────────────

  private onKeyDown = (e: KeyboardEvent) => {
    const idx = this.focusedIndex();
    if (idx === -1) return;

    const action = mapKeyEvent(e);

    switch (action.type) {
      case "insert": {
        if (this.readOnly) break;
        e.preventDefault();
        if (!this.state.isValidChar(action.char)) break;
        this.state.insert(idx, action.char);
        this.syncDisplay();
        this.emitInput();
        const next = idx + 1;
        if (next < this.inputs.length) {
          this.focusIndex(next);
        }
        this.checkComplete();
        break;
      }

      case "delete": {
        if (this.readOnly) break;
        e.preventDefault();
        const charAtIdx = this.state.charAt(idx);
        if (charAtIdx) {
          // Focused input has a value — delete it, shift left
          this.state.deleteAt(idx);
          this.syncDisplay();
          this.emitInput();
          // Move focus back if possible, else stay
          if (idx > 0) this.focusIndex(idx - 1);
        } else {
          // Empty input — just move focus back
          if (idx > 0) this.focusIndex(idx - 1);
        }
        break;
      }

      case "clear":
        if (this.readOnly) break;
        e.preventDefault();
        this.state.clear();
        this.syncDisplay();
        this.emitInput();
        this.focusIndex(0);
        break;

      case "move-next": {
        e.preventDefault();
        const dir = this.isRtl ? -1 : 1;
        const target = idx + dir;
        // Only move to next if current input is filled (spec: right on empty is no-op)
        if (
          target >= 0 &&
          target < this.inputs.length &&
          this.state.charAt(idx)
        ) {
          this.focusIndex(target);
        }
        break;
      }

      case "move-prev": {
        e.preventDefault();
        const dir = this.isRtl ? 1 : -1;
        const target = idx + dir;
        if (target >= 0 && target < this.inputs.length) {
          this.focusIndex(target);
        }
        break;
      }

      case "submit":
        e.preventDefault();
        if (this.state.isComplete()) {
          this.emitComplete();
        }
        break;

      case "ignore":
        // Let Tab pass through naturally
        break;
    }
  };

  /** Catch any input events that slip past keydown (e.g. OS autofill, mobile). */
  private onInput = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const slot = this.slotFor(target);
    if (!slot || this.readOnly) return;

    const raw = target.value;

    // OS autofill (e.g. iOS SMS code) dumps the full code into one input
    if (raw.length > 1) {
      const { endPos } = this.state.paste(slot.index, raw);
      this.syncDisplay();
      this.emitInput();
      this.focusIndex(endPos);
      this.checkComplete();
      return;
    }

    const char = raw;
    if (char && this.state.isValidChar(char)) {
      this.state.insert(slot.index, char);
      this.syncDisplay();
      this.emitInput();
      const next = slot.index + 1;
      if (next < this.inputs.length) this.focusIndex(next);
      this.checkComplete();
    } else {
      // Revert invalid input
      target.value = this.state.charAt(slot.index);
    }
  };

  private onPaste = (e: ClipboardEvent) => {
    if (this.readOnly) return;
    e.preventDefault();
    const text = e.clipboardData?.getData("text") || "";
    const idx = this.focusedIndex();
    if (idx === -1) return;

    const { endPos } = this.state.paste(idx, text);
    this.syncDisplay();
    this.emitInput();
    this.focusIndex(endPos);
    this.checkComplete();
  };

  private onClick = (e: MouseEvent) => {
    const target = e.target as HTMLInputElement;
    const slot = this.slotFor(target);
    if (!slot) return;

    // If clicked input is empty, focus first empty instead
    if (!this.state.charAt(slot.index)) {
      const firstEmpty = this.state.value.length;
      if (firstEmpty < this.inputs.length) {
        this.focusIndex(firstEmpty);
      }
    }
  };

  private onFocusIn = (e: FocusEvent) => {
    const target = e.target as HTMLInputElement;
    const slot = this.slotFor(target);
    if (!slot) return;

    // If filled, select its content
    if (this.state.charAt(slot.index)) {
      slot.selectContent();
    }
  };

  // ── helpers ────────────────────────────────────────────────────────

  private focusedIndex(): number {
    // Walk activeElement chain through shadow roots
    let active: Element | null = document.activeElement;
    while (active?.shadowRoot?.activeElement) {
      active = active.shadowRoot.activeElement;
    }
    for (let i = 0; i < this.inputs.length; i++) {
      if (this.inputs[i].input === active) return i;
    }
    return -1;
  }

  private focusIndex(idx: number) {
    const slot = this.inputs[idx];
    if (!slot) return;
    slot.focus();
    if (this.state.charAt(idx)) {
      slot.selectContent();
    }
  }

  private slotFor(input: HTMLInputElement): PrimaveraOtpInput | null {
    for (const slot of this.inputs) {
      if (slot.input === input) return slot;
    }
    return null;
  }

  private syncDisplay() {
    for (let i = 0; i < this.inputs.length; i++) {
      this.inputs[i].setValue(this.state.charAt(i));
    }
    if (this.hiddenInput) {
      this.hiddenInput.value = this.state.value;
    }
  }

  private checkComplete() {
    if (this.autoSubmit && this.state.isComplete()) {
      this.emitComplete();
    }
  }

  private emitInput() {
    this.dispatchEvent(
      new CustomEvent("otp-input", {
        detail: { value: this.state.value },
        bubbles: true,
      }),
    );
  }

  private emitComplete() {
    this.dispatchEvent(
      new CustomEvent("otp-complete", {
        detail: { value: this.state.value },
        bubbles: true,
      }),
    );
  }
}
