# @primavera-ui/dnd

Optimistic, virtual drag & drop list (or tree) where the dragged item appears as if it is physically lifted from the list and dragged around. Statically sized items only.

## Props for dnd-list<T: Any>
Name | Type | Default
|---|---|
| drag-type | ‘native’ \| ‘overlay’ | ‘overlay’
| source | DndSource | -
| overscan | number | 2

## Web Component
```
<dnd
	drag-type="native"
	source: DndSource
	renderer: DndRenderer
/>
```

## DndSource
```typescript
type Key = string | number;

type DndOp =
  | { type: "move"; keys: Key[]; beforeKey: Key | null }
  | { type: "insert"; item: any; beforeKey: Key | null }
  | { type: "remove"; key: Key }
  | { type: "update"; key: Key; patch: any };

interface DndSource<T> {
  // Read
  getKey(item: T): Key;
  // State
  getOrder(): readonly Key[];
  getItem(key: Key): T

  // Notify
	subscribe(cb: (hint?: { type: "order" | "items" | "keys"; keys?: Key[] }) => void)

  // Write (host calls these)
	apply(op: DndOp): void;
}

interface DndRenderer<T> {
  mount(key: Key, item: T, container: HTMLElement): () => void;
  getNativeDropData?(keys: Key[], items: T[]): Array<{ type: string; data: string }>;
}
```

## DOM Layout
```
<div class="consumer">
	<div class="parent">
		<div role="list">
			...<div role="listitem" />
		</div>
		<canvas />
	</div>
</div>
```

## Specifications
1. Regular list structure comprised of `parent` container `<div class="parent">` , the `<div role="list">` list and `<div role="listitem">` listitems.
2. Canvas sits inside parent after `<div role="listitem">`. This is a deliberate choice as in practice the animation is smoother.
2. A 2D canvas with identical dimensions to parent div sits directly behind parent div, anchored to same position. (position: absolute)
2. The `parent` has `overflow-y: scroll` and is sized by the component consumer. Scroll position can be modified natively.
3. `listitem` are a fixed size and absolutely positioned, determined by their `top` px value. There is a `transition` on `top` of 0.15s to support smooth movement as surrounding list items are added, moved and removed.
4. `DndSource` is a class that has read only access to array of all list items, `key` which is the item property that will be used to key items. `DndSource.apply` is to be called by the consumer to inform the list of externally sourced updates.
5. `DndSource.getOrder` produces an ordered index of item `key`s. This is what the `listitems`s will be rendered against, using `DndSource.getItem(key)`. This should be a direct diff against the currently displayed items, so it is necessary to maintain a `Map<key, listitem>` map within the component state.
4. The initial height of `list` is defined by `(qty + 2)(listitem) * height(listitem)`. The 2 is for a small amount of buffer at the end of a list.
6. Only items within view + overscan either side will be rendered. The top-most item index `startIndex = max(floor(scrollTop / H) - overscan, 0)` where `overscan` is a fixed value (usually 2). The end index is defined by `endIndex = min(startIndex + ceil(viewportHeight / H) + overscan*2, count)`. A range is held in state that updates as scrollYOffset(parent) changes, e.g. due to scrolling. As the range changes, new items in the range render, and items outside the range drop off. There is the option here for a pool of hot rendered items.
7. One or more items can be selected. A set of item keys will be used to track selected items. And a Key[] to maintain order. `aria-selected: true` will be applied on these elements if rendered.
8. On click or touch: if the item is unselected, the selection set will include only that item. If the item is selected, nothing will happen. If the user then starts dragging, `drag` mode starts. A slight buffer of 3px, easily calculated with Pythagoras should be required before drag begins.
9. In `drag` mode, `getOrder()` will be called but with selected items filtered out to produce `previewOrder`.
10. In `drag` mode, the item underneath the mouse pointer, and all items below that, will move down. This could be done through a simple (`if item.idx > cur_hover_index, top += height(<li>)`). If the pointer leaves the parent container, the snapshot renders as is without the nudge down.
11. If `drag-type=‘native’`, the <li> component will have draggable attribute set to true. On HTML native `drag` event, it will call `event.dataTransfer.setData` with the properties of getNativeDropData().
12. If `drag-type=‘overlay'`, the `<li>` component will have draggable attribute set to false. An overlay div with `position absolute; top: 0, left: 0, width: 100vh, height 100vh` will take up the entire page, it may have to be added to the `<body>` and be tracked so it can be taken down when `drag` mode ends. A copy of the first 3 items are taken and presented as a stack, with a number signifying the total count of grabbed items. The stack follows the cursor, slightly lagged, with slightly increasing lag for each item lower in the stack.
13. Drag mode is ended when user releases the mouse or when the user hits escape. If the user was hovering over an item and thus an index is tracked, that item will provide the “beforeKey” in the move op.
14. Edge case: as mentioned there is extra space of `2*buffer` at the end of the list, user’s pointer intersection with this space can be tracked by checking if the user is south of `(qty(listitem) + 2)` but still within `list`’s bounds.

TODO: Autoscrolling at top and bottom
TODO: Keyboard events + keyboard modifiers for mouse events + touch events
TODO: Canvas placeholders
TODO: Dnd Context to link multiple lists


## Sub-items i.e. tree extension specifications
TODO: Basically add children support, expand/collapse & flatten items for preview with depth attr for renderer to understand correctly. At the edge, use x plane to decide whether you are nesting an item or putting it below on the same level - probably needs some visual notifier.
