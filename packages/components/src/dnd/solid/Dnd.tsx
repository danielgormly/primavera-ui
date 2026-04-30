import {
  createMemo,
  createSignal,
  onMount,
  onCleanup,
  createEffect,
  on,
  type JSX,
} from "solid-js";
import { render } from "solid-js/web";
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
    }
  }
}

export interface DndProps<T> {
  items: T[];
  setItems?: (next: T[]) => void;
  onReorder?: (op: DndOp<T>) => void;
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
  roundedSelect?: boolean;
  autofocus?: boolean;
  dragType?: "native" | "overlay";
  class?: string;
  style?: JSX.CSSProperties | string;
  children: (item: () => T, expanded: () => boolean) => JSX.Element;
}

export function Dnd<T>(props: DndProps<T>): JSX.Element {
  register();

  let el!: PrimaveraDnd;
  let source: DndSource<T> | null = null;

  const keyIndex = createMemo(() => {
    const m = new Map<Key, T>();
    for (const item of props.items) m.set(props.getKey(item), item);
    return m;
  });

  const [expandedKey, setExpandedKey] = createSignal<Key | null>(null);

  const renderer: DndRenderer<T> = {
    mount(key, initialItem, container) {
      const dispose = render(() => {
        const item = createMemo(() => keyIndex().get(key) ?? initialItem);
        const expanded = createMemo(() => expandedKey() === key);
        return props.children(item, expanded);
      }, container);
      return dispose;
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
      attr:rounded-select={String(props.roundedSelect ?? true)}
      attr:autofocus={props.autofocus ? "" : undefined}
    />
  );
}
