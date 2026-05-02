import {
  createMemo,
  createSignal,
  onMount,
  onCleanup,
  createEffect,
  createRoot,
  getOwner,
  on,
  type JSX,
} from "solid-js";
import { insert } from "solid-js/web";
import { DndSource } from "../core/source";
import { DndSelection } from "../core/selection";
import { register } from "../index";
import { PrimaveraDnd } from "../vanilla/container";
import type { Key, DndOp, DndRenderer } from "../core/types";

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      "primavera-dnd": JSX.HTMLAttributes<HTMLElement>;
    }
    interface ExplicitAttributes {
      "item-height": string;
      expandable: string;
      "drag-type": "native" | "overlay";
      overscan: string;
      "confine-autoscroll": string;
      "autoscroll-buffer": string;
      "drag-stack-count": string;
      nudge: string;
      "rounded-select": string;
      autofocus: string;
      multi: string;
      "clear-on-click-outside": string;
      "fill-height": string;
      reorder: string;
    }
  }
}

export interface DndProps<T> {
  items: T[];
  setItems?: (next: T[]) => void;
  onReorder?: (op: DndOp<T>) => void;
  /** Receives the underlying `<primavera-dnd>` element for imperative calls
   *  like `setExpanded(key)` / `getExpanded()` / `getSelection()`. */
  ref?: (el: PrimaveraDnd) => void;
  getKey: (item: T) => Key;
  /**
   * Optional consumer-owned selection model. When provided, the consumer
   * can mutate / observe selection from outside. Treated as a single-shot
   * injection — swapping the prop after mount is not supported (same shape
   * as `items`/source: re-mount the Dnd to swap).
   */
  selection?: DndSelection;
  itemHeight?: number;
  expandable?: boolean;
  overscan?: number;
  confineAutoscroll?: boolean;
  autoscrollBuffer?: number;
  dragStackCount?: number;
  nudge?: boolean;
  /** When false, this list refuses to reorder itself. Drag still picks up
   *  items and fires `primavera-dnd-drag*` events (so foreign drop zones
   *  still work), but nudge, placeholder, same-list drop, and ⌘/ctrl+↑/↓
   *  are suppressed. Default true. */
  reorder?: boolean;
  roundedSelect?: boolean;
  autofocus?: boolean;
  /** When false, shift/cmd-click and shift+arrow keys collapse to
   *  single-select. Default true. */
  multi?: boolean;
  /** When true, a click anywhere outside the Dnd element clears
   *  selection. Default false. */
  clearOnClickOutside?: boolean;
  /** When true, the host fills its parent's height (the original behaviour:
   *  host + scroll viewport are `height: 100%`, listbox `min-height: 100%`).
   *  When false (default), the host collapses to content height — use this
   *  inside auto-height parents so siblings stack cleanly underneath. */
  fillHeight?: boolean;
  dragType?: "native" | "overlay";
  class?: string;
  style?: JSX.CSSProperties | string;
  children: (item: () => T, expanded: () => boolean) => JSX.Element;
}

export function Dnd<T>(props: DndProps<T>): JSX.Element {
  register();

  let el!: PrimaveraDnd;
  let source: DndSource<T> | null = null;

  // Captured at component setup so per-item roots can chain to the host's
  // owner — keeps `useContext`, error boundaries, and cleanup propagation
  // working across the custom-element boundary.
  const owner = getOwner();

  const keyIndex = createMemo(() => {
    const m = new Map<Key, T>();
    for (const item of props.items) m.set(props.getKey(item), item);
    return m;
  });

  const [expandedKey, setExpandedKey] = createSignal<Key | null>(null);

  const renderer: DndRenderer<T> = {
    mount(key, initialItem, container) {
      return createRoot((dispose) => {
        insert(container, () => {
          const item = createMemo(() => keyIndex().get(key) ?? initialItem);
          const expanded = createMemo(() => expandedKey() === key);
          return props.children(item, expanded);
        });
        return dispose;
      }, owner ?? undefined);
    },
    setExpanded(key) {
      setExpandedKey(() => key);
    },
  };

  onMount(() => {
    source = new DndSource<T>({
      getKey: props.getKey,
      getOrder: () => props.items.map(props.getKey),
      getItem: (key) => keyIndex().get(key),
    });

    source.onChange((op) => {
      if (op.type === "move" && props.setItems) {
        const keySet = new Set(op.keys);
        const moved = op.keys
          .map((k) => keyIndex().get(k))
          .filter((i): i is T => i !== undefined);
        const filtered = props.items.filter(
          (i) => !keySet.has(props.getKey(i)),
        );
        let next: T[];
        if (op.beforeKey === null) {
          next = [...filtered, ...moved];
        } else {
          const idx = filtered.findIndex(
            (i) => props.getKey(i) === op.beforeKey,
          );
          if (idx === -1) next = [...filtered, ...moved];
          else {
            next = [...filtered];
            next.splice(idx, 0, ...moved);
          }
        }
        props.setItems(next);
      }
      props.onReorder?.(op);
    });

    el.setSource(source);
    if (props.selection) el.setSelection(props.selection);
    el.setRenderer(renderer);
    props.ref?.(el);
  });

  // External item changes — re-sync source order
  createEffect(
    on(
      () => props.items,
      () => {
        if (source) source.syncOrder();
      },
      { defer: true },
    ),
  );

  onCleanup(() => {
    // PrimaveraDnd.disconnectedCallback handles its own teardown
  });

  return (
    <primavera-dnd
      ref={el}
      class={props.class}
      style={props.style as any}
      attr:item-height={String(props.itemHeight ?? 40)}
      attr:expandable={props.expandable ? "" : undefined}
      attr:drag-type={props.dragType ?? "overlay"}
      attr:overscan={props.overscan != null ? String(props.overscan) : undefined}
      attr:confine-autoscroll={String(props.confineAutoscroll ?? true)}
      attr:autoscroll-buffer={
        props.autoscrollBuffer != null ? String(props.autoscrollBuffer) : undefined
      }
      attr:drag-stack-count={
        props.dragStackCount != null ? String(props.dragStackCount) : undefined
      }
      attr:nudge={String(props.nudge ?? true)}
      attr:reorder={props.reorder === false ? "false" : undefined}
      attr:rounded-select={String(props.roundedSelect ?? true)}
      attr:autofocus={props.autofocus ? "" : undefined}
      attr:multi={props.multi === false ? "false" : undefined}
      attr:clear-on-click-outside={props.clearOnClickOutside ? "" : undefined}
      attr:fill-height={props.fillHeight ? "" : undefined}
    />
  );
}
