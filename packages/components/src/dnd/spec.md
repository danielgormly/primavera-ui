# @primavera-ui/dnd

Optimistic, virtual drag & drop list (or tree) where the dragged item appears as if it is physically lifted from the list and dragged around. Statically sized items only.

## Props for dnd-list<T: Any>
Name | Type | Default
|---|---|
| drag-type | ‘native’ \| ‘overlay’ | ‘overlay’
| source | DndSource | -
| overscan | number | 2
| rounded-select | boolean | true
| autofocus | boolean | true
| item-height | number | 32
| confine_autoscroll | boolean | true
| drag_buffer | number | 32
| autoscroll_height | number | 32

## Web Component
```
<dnd
	drag-type="native"
	source: DndSource
	renderer: DndRenderer
	context: DragContext
	rounded-select: true
/>
```

## DndSource
```typescript
type Key = string | number;

type DndOp =
  | { type: "move"; keys: Key[]; beforeKey: Key | null }
  | { type: "insert"; items: T[]; beforeKey: Key | null }
  | { type: "remove"; keys: Key[] }
  | { type: "update"; key: Key; patch: any }
  | { type: "reset"; keys: Key[] };

interface DndSourceArgs {
	getKey,
	getOrder,
	getItem,
}

class DndSource<T> {
  getKey(item: T): Key;
  getOrder(): readonly Key[];
  getItem(key: Key): T
	constructor(props: DndSourceArgs) {
		this.getKey = props.getKey;
		this.getOrder = props.getOrder;
		this.getItem = props.getItem;
	}

	 // optional 2-phase commit implementation
  _commitUI(txn) // optimistic ui update
  _commitState(txnId) // Writes changes on move/delete

	// Host can call this so list can apply external updates
	apply(ops: DndOp[]): TxnId
	// Host can call this to see updates produced by list
	onChange(cb: (op: DndOp, txnId: TxnId) => void): () => void //
}

// E.g.
type Key = string;
type Item = {
	key: Key,
};
const data = [];
const keyIndex = new Map<Key, Item>();

const source = new DndSource({
	getKey: (item: T) => item.key,
	getOrder: () => data.map((item) => item.key),
	getItem(key: Key) => keyIndex.get(key);
});

interface DndRenderer<T> {
  mount(key: Key, item: T, container: HTMLElement): () => void;
  getNativeDropData?(keys: Key[], items: T[]): Array<{ type: string; data: string }>;
}

interface DragContext {
	register(renderer, source) {}
}
```

## DOM Layout
```
<div class="consumer">
	<div class="parent">
		<div role="listbox" aria-multiselectable="true">
			...<div role="option" />
		</div>
		<canvas />
	</div>
</div>
```

## Data model
1. `DndSource` is a class that has read only access to array of all list items. It takes three key access functions provided by the consumer. `getKey()`, `getItem()` and `getOrder()`. `getOrder()` is called once by `DndSource()` to create an internally cached order which is then kept in sync.
2. `DndSource` produces mutation intent & receives external updates. A two-phase commit allow optimistic ui changes. Transactions are created on local mutation actions & `DndSource.commitUI` caches these to preview state (pulled via getOrder()). Given a transaction, commitUI must occur successfully before commitState. `DndSource.commitState()` commits changes back to the host to process. The host receives external updates via apply() called by the host. The host receives updates from the producer via registering a callback to `onChange()`.
3. `DndSource.getOrder` produces an ordered index of item `key`s. This is what the `listitems`s will be rendered against, using `DndSource.getItem(key)`. This should be a direct diff against the currently displayed items, so it is necessary to maintain a `Map<key, listitem>` map within the component state.
5. DragContext is provided to `<dnd>` (or created per dnd automatically if not provided). DragContext allows the consumer to share drag contexts between DndRenderers. Items can thus be dragged from one list to another.
6. TODO: Undo/redo interface

## Markup/Sizing
1. Regular list structure comprised of `parent` container `<div class="parent">` , the `<div role="listbox">` list and `<div role="option">` listitems.
2. A 2D canvas with identical dimensions to parent div sits directly behind parent div, anchored to same position. (position: absolute). This is a deliberate choice to make animations smooth and keep DOM layout simple.
3. The `parent` has `overflow-y: scroll` and is sized by the component consumer. Scroll position can be modified natively.
4. `listitem` are a fixed size and absolutely positioned, determined by their `top` px value. There is a `transition` on `top` of 0.15s to support smooth movement as surrounding list items are added, moved and removed.
5. The initial height of `list` is defined by `(qty(listitem) + 2) * height(listitem)`. The 2 is for a small amount of buffer at the end of a list.
6. Only items within view + overscan either side will be rendered. The top-most item index `startIndex = max(floor(scrollTop / H) - overscan, 0)` where `overscan` is a fixed value (usually 2). The end index is defined by `endIndex = min(startIndex + ceil(viewportHeight / H) + overscan*2, count)`. A range is held in state that updates as `scrollYOffset(parent)` changes, e.g. due to scrolling. As the range changes, new items in the range render, and items outside the range drop off. There is the option here for a pool of hot rendered items.
7. One or more items can be selected. A set of item keys will be used to track selected items. And a Key[] to maintain order. `aria-selected: true` will be applied on these elements if rendered. Select is probably best managed with its own controller per list.

## Interactions
10. The range kb modifier, if held while clicking above the top-most selected item, will select a range from the bottom-most selected item, to the item clicked. If held while clicking below the top-most selected item, will select a range from the top-most to the item clicked.
11. The toggle kb modifier, if held while clicking on a selected item, will deselect that item. If held while clicking on a deselected item, will select that item. In both cases the remainder of the select set is preserved.
12. Arrow down & Arrow up will remove all selected items, except the item above the last touched (clicked or touched) item. The only exception is if the user has toggled off an item while other selected items remain, in this case the next or previous item from the top-most selected item will be selected, respective to the arrow key press.
13. If the range modifier key is held during an arrow up/down press, the existing contiguous range that incorporates the last-touched item will extend upwards/downwards. If the last-touched item was toggled off, the chosen contiguous range will be the top or bottom most items respectively.
14. When up/down arrows are pressed with toggle modifier, a new order is created consisting of all selected items such that they form a contiguous range within the greater list. This order is then moved up/down with respective arrow key presses. If the up arrow is pressed, the items move above the top-most item. If the down arrow is pressed, the bottom-most item.

## Selection interactions
Keyboard modifiers allow users to select multiple items in various patterns.

Only one list can be focused at a time, .
The entire list a tab-stoppable. Tab/Shift+Tab will focus out of the list.

When an out-of-view item is selected, the scroll position should quickly, but smoothly shift to that item position.

## Selection state machine

We will use a state machine to describe our keyboard/mouse/touch interaction model (up until dragging). Note that these states in implementation may be implicit by way of selection state and anchor.

Selections operates on non-contiguous block groups.

Note: SINGLE, RANGE and MULTI are descriptive aliases for ACTIVE BLOCK.
In implementation, selection is a set of Blocks — MULTI is blocks.length > 1,
SINGLE is one block where anchor == to, RANGE is one block where anchor != to.
Block merge on adjacency/overlap is implicit throughout.

Definitions:
- IDLE: Nothing selected
- SINGLE: A single item selected
- RANGE: A contiguous range of multiple items is selected
- MULTI: There are multiple single or ranges of non-contiguous items selected
- Anchor: nullable, a single item used to anchor selection and range walks/expansions/contractions.
- Adjacent: Unselected item adjacent to selected item
- next(item) = item below, or item itself if at end of list
- prev(item) = item above, or item itself if at top of list

IDLE
  → click(item)           → SINGLE(anchor=item)
  → arrowDown            → SINGLE(anchor=bottom)
  → arrowUp               → SINGLE(anchor=top)

SINGLE(anchor)
  → click(item)           → SINGLE(anchor=item)
  → shift+click(anchor)   → SINGLE(anchor)   // no-op
  → shift+click(item)     → RANGE(from=anchor, to=item)
	→ cmd+click(anchor)     → IDLE
  → cmd+click(adjacent)   → RANGE(from=anchor, to=other)
	→ cmd+click(other)      → MULTI(toggled={anchor, other}, anchor=other)
  → arrowDown             → SINGLE(anchor=next(anchor))
  → arrowUp               → SINGLE(anchor=prev(anchor))
  → shift+arrowDown       → RANGE(from=anchor, to=next(anchor))
  → shift+arrowUp         → RANGE(from=anchor, to=prev(anchor))
  → escape                → IDLE

RANGE(from, to)
  → shift+click(item)  → RANGE(anchor, to=item)  // can grow or shrink
  → shift+arrowDown       → RANGE(from=from, to=next(to))
  → shift+arrowUp         → RANGE(from=from, to=prev(to))
  → click(item)           → SINGLE(anchor=item)        // collapses range
  → escape                → IDLE

MULTI(toggled, anchor: Key | null)
  → cmd+click(anchor)     → MULTI(toggled-anchor, anchor=null)
  → cmd+click(item)       → MULTI(toggle item in toggled, anchor=item)
  → cmd+arrowDown         → MOVE(contiguous block of toggled, down)
  → cmd+arrowUp           → MOVE(contiguous block of toggled, up)
	→ shift+arrowDown       → MULTI(toggled + next(bottom of anchor's range), anchor), if isContiguous(toggled): → RANGE(from=top, to=bottom)
  → shift+arrowUp          → MULTI(toggled + prev(top of anchor's range), anchor), if isContiguous(toggled): → RANGE(from=top, to=bottom)
  → click(item)           → SINGLE(anchor=item)
  → escape                → IDLE


## Drag mode
19. On click or touch: if the item is unselected, the selection set will include only that item. If the item is selected, nothing will happen. If the user then starts dragging, `drag` mode starts. A slight buffer of 3px, easily calculated with Pythagoras should be required before drag begins.
20. In `drag` mode, a preview order is generated with selected items filtered out. Selected elements can be held in a cache, to avoid a re-render when used in drag overlay mode or when put back in the list.
21. In `drag` mode, the item underneath the mouse pointer, and all items below that, will move down. This could be done through a simple (`if item.idx > cur_hover_index, top += height(<li>)`). If the pointer leaves the parent container, the snapshot renders as is without the nudge down.
22. If `drag-type=‘native’`, the `listitem` component will have draggable attribute set to true. On HTML native `drag` event, it will call `event.dataTransfer.setData` with the properties of getNativeDropData().
23. If `drag-type=‘overlay'`, the `<li>` component will have draggable attribute set to false. An overlay div with `position absolute; top: 0, left: 0, width: 100vw, height 100vh` will take up the entire page, it may have to be added to the `<body>` and be tracked so it can be taken down when `drag` mode ends. A copy or reference of the first 3 item elements are taken and presented as a stack of items, each [2px, 2px] and a lower depth than the previous, with a number signifying the total count of grabbed items. The stack follows the cursor, with a slight lag (additional 30ms for each lower depth), with slightly increasing lag for each item lower in the stack.
24. Drag mode is ended when user releases the mouse or when the user hits escape. If the user was hovering over an item and thus an index is tracked, that item will provide the “beforeKey” in the move op.
25. Edge case: as mentioned there is extra space of `(2 * height(listitem)` at the end of the list, user’s pointer intersection with this space can be tracked by checking if the user is south of `qty(listitem)` but still within `list`’s bounds. The hover index will be `qty(listitem) + 1`
26. The autoscroll controller tracks the user’s drag position. If the drag position is above `parent top offset + dragBuffer`, the list will automatically scroll up, accelerating over 2 seconds. If the drag position is below `parent bottom offset - autoscrollHeight`, the list will scroll down in the same way. If `confineAutoscroll` is enabled, autoscroll will only occur when drag is within the parent’s y bounds and will stop when moved above/below the parent. Autoscroll stops when user leaves the x-bounds of the parent, the autoscroll region, or stops dragging.
27. The canvas renders a placeholder directly below the hover space. The calculated position is `hover_index * height(listitem) - scrollTop`. When the drag is outside the parent there is no placeholder. When the user is at the bottom of the list, the placeholder y position must be at `items.length * height(listitem)`.
29. `rounded-select: true` will generate css border-radius within a style block inside the component, around contiguous selection groups, using sibling/next/previous selectors to do so, such that each contiguous selection appears as block with rounded edges.

TODO: Mid-drag update prevention?!

## TODO: Sub-items i.e. tree extension specifications
TODO: Basically add children support, expand/collapse & flatten items for preview with depth attr for renderer to understand correctly. At the edge, use x plane to decide whether you are nesting an item or putting it below on the same level - probably needs some visual notifier.
