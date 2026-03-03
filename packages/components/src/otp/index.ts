export { PrimaveraOtp } from "./otp-container";
export { PrimaveraOtpInput } from "./otp-input";
export { OTPState } from "./otp-state";
export type { OTPMode } from "./otp-state";
export { mapKeyEvent } from "./otp-keyboard";
export type { OTPAction } from "./otp-keyboard";

import { PrimaveraOtp } from "./otp-container";
import { PrimaveraOtpInput } from "./otp-input";

export function register() {
  if (typeof customElements === "undefined") return;
  if (!customElements.get("primavera-otp")) {
    customElements.define("primavera-otp", PrimaveraOtp);
  }
  if (!customElements.get("primavera-otp-input")) {
    customElements.define("primavera-otp-input", PrimaveraOtpInput);
  }
}
