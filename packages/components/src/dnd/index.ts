export type {
  Key,
  TxnId,
  DndOp,
  Block,
  Selection,
  DndSourceArgs,
  DndRenderer,
  DragContext,
} from "./dnd-types";

export { DndSource } from "./dnd-source";
export { DndSelection } from "./dnd-selection";
export { PrimaveraDnd } from "./dnd-container";

import { PrimaveraDnd } from "./dnd-container";

export function register() {
  if (typeof customElements === "undefined") return;
  if (!customElements.get("primavera-dnd")) {
    customElements.define("primavera-dnd", PrimaveraDnd);
  }
}
