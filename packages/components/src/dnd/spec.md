# @primavera-ui/dnd

Optimistic, virtual drag & drop list with multiple select. Statically sized items only.

## Props for dnd-list<T: Any>
Name | Type | Default
|---|---|
| drag-type | ‘native’ \| ‘overlay’ | ‘overlay’
| source | DndSource | -
| overscan | number | 2
| rounded-select | boolean | true
| autofocus | boolean | true
| item-height | number | 32
| confine-autoscroll | boolean | true
| autoscroll-buffer | number | 32
| autoscroll-height | number | 32
| drag-stack-count | number | 3

## Web Component
```
<dnd
	drag-type="native"
	source: DndSource
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

	 // internal 2-phase commit (implementation example)
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
2. `DndSource` produces mutation intent & receives external updates. A two-phase commit allow optimistic ui changes. Transactions are created on local mutation actions & `DndSource._commitUI` caches these to preview state (pulled via getOrder()). Given a transaction, commitUI must occur successfully before commitState. `DndSource._commitState()` commits changes back to the host to process. The host receives external updates via apply() called by the host. The host receives updates from the producer via registering a callback to `onChange()`.
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

## Selection

### Selection interactions
1. List focus: The entire list a tab-stoppable. Tab/Shift+Tab will focus out of the list. Only one list can be focused at a time. Mouse click on list automatically focuses on list and applies relevant selection action.
2. Offset: When an out-of-view item is selected, the scroll position should quickly, but smoothly shift to that item position.

### Selection model

1. A block is a group of contiguous items; this could be a single item or a discrete range.
2. Selections comprise one or more non-contiguous blocks. Therefore, blocks must merge implicitly when 2 blocks are adjacent or overlapping.
3. The stable end of a block is the `anchor`, while the fluid end is `to`.
4. `Anchor` may be always explicitly defined, or sometimes inferred from context. Implementation is flexible.
5. `Adjacent` refers to previously unselected block next to another block.

#### Relative identifiers
- first: the first item in the list (top of the full list)
- last: the last item in the list (bottom of the full list)
- next(item): item below, or item itself if at end of list
- prev(item): item above, or item itself if at top of list
- top(block): the upper boundary item of a block
- bottom(block): the lower boundary item of a block
- topmost: the block with the highest position in the list, i.e. blocks[0]
- bottommost: the block with the lowest position in the list, i.e. blocks[last]
- top(selection): shorthand for top(topmost)
- bottom(selection): shorthand for bottom(bottommost)

#### Implicit states

For explanatory purposes, there are 4 commonly ocurring implicit states:

- Idle: No items selected
- Single: One block consisting of one item selected.
- Range: One block selected.
- Multiple: Two or more blocks selected. Active is the block currently targeted by shift/arrow operations.

#### Types
```
type Block = {
  anchor: Key,
  to: Key,       // anchor == to for single item; defines fluid end of block
}

type Selection = {
  blocks: Block[],  // ordered by position in list; never overlapping
  active: Block | null,
}
```

#### Behaviour

```
selectOnly(item)
  blocks = [{anchor: item, to: item}]
  active = blocks[0]

addBlock(item)
  b = {anchor: item, to: item}
  blocks += b
  active = b
  → merge

extendActive(item)
  active.to = item
  → merge

toggleItem(item)
  if item ∈ active:
    remove item from active (shrink, or split if interior)
    active = nearest remaining block
  else:
    addBlock(item)
  → merge

moveSelection(dir)
  shift all blocks up/down by 1 position, clamped to list bounds
  preserve active

merge:
  sort blocks by top(block)
  collapse any adjacent or overlapping blocks into one
  if active was consumed by merge, active = merged block
```

#### Performance optimisations
It may be worth keeping an index to describe blocks e.g. itemToBlock: Map<Key, Block> to ensure O(1) operations esp re. merge.

### Selection interaction bindings

TODO: macOS vs WINDOWS/Linux, not macOS vs Linux

| macOS | Linux | Condition | Operation |
|---|---|---|---|
| `click` | `click` | any | `selectOnly(item)` |
| `⌥+↑` | `⌥+↑` | any | `selectOnly(first)` |
| `⌥+↓` | `⌥+↓` | any | `selectOnly(last)` |
| `↓` | `↓` | nothing selected | `selectOnly(top)` |
| `↑` | `↑` | nothing selected | `selectOnly(bottom)` |
| `↓` | `↓` | selected | `selectOnly(next(selBottom))` |
| `↑` | `↑` | selected | `selectOnly(prev(selTop))` |
| `shift+click` | `shift+click` | any | `extendActive(item)` |
| `shift+↓` | `shift+↓` | any | `extendActive(next(bottom(active)))` |
| `shift+↑` | `shift+↑` | any | `extendActive(prev(top(active)))` |
| `shift+⌘+↓` | `shift+ctrl+↓` | any | `extendActive(last)` |
| `shift+⌘+↑` | `shift+ctrl+↑` | any | `extendActive(first)` |
| `⌘+click` | `ctrl+click` | item ∉ selection | `addBlock(item)` |
| `⌘+click` | `ctrl+click` | item ∈ selection | `toggleItem(item)` |
| `⌘+↓` | `ctrl+↓` | any | `moveSelection(down)` |
| `⌘+↑` | `ctrl+↑` | any | `moveSelection(up)` |
| `escape` | `escape` | any | `blocks = []; active = null` |

Custom bindings by consumer should be accounted for in kb interface.

## Drag mode
1. On click: if the item is unselected, the selection set will include only that item. If the item is selected, nothing will happen. If the user then starts dragging, `drag` mode starts. A slight buffer of 3px, easily calculated with Pythagoras should be required before drag begins.
2. In `drag` mode, a preview order is generated with selected items filtered out. Selected elements can be held in a cache, to avoid a re-render when used in drag overlay mode or when put back in the list.
3. In `drag` mode, the item underneath the mouse pointer, and all items below that, will move down. This could be done through a simple (`if item.idx > hoverIndex, top += height(<li>)`). If the pointer leaves the parent container, the snapshot renders as is without the nudge down.
4. If `drag-type=‘native’`, the `listitem` component will have draggable attribute set to true. On HTML native `drag` event, it will call `event.dataTransfer.setData` with the properties of getNativeDropData().
5. If `drag-type=‘overlay'`, the `<li>` component will have draggable attribute set to false. An overlay div with `position absolute; top: 0, left: 0, width: 100vw, height 100vh` will take up the entire page, it may have to be added to the `<body>` and be tracked so it can be taken down when `drag` mode ends. A copy or reference of the first `drag-stack-count` item elements are taken and presented as a stack of items, each [2px, 2px] further from and a lower depth than the previous, with a number signifying the total count of grabbed items. The stack follows the cursor, with a slight lag (additional 30ms for each lower depth), with slightly increasing lag for each item lower in the stack.
6. Drag mode is ended when user releases the mouse or when the user hits escape. If the user was hovering over an item and thus an index is tracked, that item will provide the “beforeKey” in the move op.
7. Edge case: as mentioned there is extra space of `(2 * height(listitem)` at the end of the list, user’s pointer intersection with this space can be tracked by checking if the user is south of `qty(listitem)` but still within `list`’s bounds. The hover index will be `qty(listitem) + 1`
8. The autoscroll controller tracks the user’s drag position. If the drag position is above `parent top offset + autoscroll-buffer`, the list will automatically scroll up, accelerating over 2 seconds. If the drag position is below `parent bottom offset - autoscroll-buffer`, the list will scroll down in the same way. If `confine-autoscroll` is enabled, autoscroll will only occur when drag is within the parent’s y bounds and will stop when moved above/below the parent. Autoscroll stops when user leaves the x-bounds of the parent, the autoscroll region, or stops dragging.
9. The canvas renders a placeholder directly below the hover space. The calculated position is `hoverIndex * height(listitem) - scrollTop`. When the drag is outside the parent there is no placeholder. When the user is at the bottom of the list, the placeholder y position must be at `items.length * height(listitem)`.
10. `rounded-select: true` will generate css border-radius within a style block inside the component, around contiguous selection groups, using sibling/next/previous selectors to do so, such that each contiguous selection appears as block with rounded edges. Top & bottom of virtualised window are always at the border even if there's an adjacent selected item, so may be render those edges incorrectly - this is ok because they're out of view.

## Touch devices (differences from mouse drag/select model)
1. Multi-select is currently not possible on touch devices.
2. A tap constitutes select one behaviour.
3. A drag with an initial hold of less than 150ms initiates a scroll.
4. A drag with a hold of more than 150ms & 3px drag buffer initiates an item drag.
5. `touchmove` must be tracked to determine hoverIndex & leaving parent.

## TODO (prior to release)
1. Mid-drag update prevention
2. DragContext thorough specification
3. Nudge behaviour should be optional (this needs to be optional to support trees!)


## FUTURE (Out of scope)
1. tree extension specifications
TODO: Basically add children support, expand/collapse & flatten items for preview with depth attr for renderer to understand correctly. At the edge, use x plane to decide whether you are nesting an item or putting it below on the same level - probably needs some visual notifier.
2. Edit mode - allows for multiple selection & bulk actions on touch devices.
