NOTE: This is an LLM generated file with fixes that were required from initial generation

## Nudge

During a drag, if `nudge` is enabled, the remaining (non-dragged) items shift down to open a gap at the cursor position, giving visual feedback of where the drop will land.
- **Critical:** dragged items are visually hidden during drag. The remaining items are laid out contiguously — there are no empty slots where dragged items used to be. All hover-index and positioning math must operate in this **collapsed coordinate space**, not the original order.

Let `filtered` = the ordered list with all dragged keys removed. Then:
- `nonDragCount = filtered.length`
- Each non-dragged item's base position: `visualIdx * itemHeight`, where `visualIdx` is its index within `filtered`.

### hoverIndex calculation

`hoverIndex` is a slot index in the collapsed space representing where the gap should open.

```
y = mouseY - parentRect.top + scrollTop
hoverIndex = clamp(floor(y / itemHeight), 0, nonDragCount)
```

This directly divides the mouse Y by item height — no mapping through the original order. The max is `nonDragCount` (not `nonDragCount - 1`) to allow dropping at the very end.

### Applying nudge offsets

For each non-dragged item with `visualIdx` in `filtered`:
- If `visualIdx >= hoverIndex`: `top = (visualIdx * itemHeight) + itemHeight`
- Otherwise: `top = visualIdx * itemHeight`

The gap is always exactly one `itemHeight`, regardless of how many items are being dragged.

### Placeholder

The canvas placeholder line is drawn at `hoverIndex * itemHeight - scrollTop`. When the pointer leaves the parent, both the placeholder and nudge offsets are removed.

## Drag end: item re-mount

During drag, dragged items are hidden (`opacity: 0`, `pointer-events: none`) but remain in the DOM with their **pre-drag** `top` value. Since items have `transition: top 0.15s ease`, restoring visibility after the move op causes a visible flash — the item appears at its old position and animates to the new one.

**Fix:** when drag ends, remove dragged items from the DOM (and the rendered item cache) **before** clearing drag state and calling `renderList()`. The render pass then re-mounts them as fresh elements at their correct new position. Fresh mounts have no prior `top` to transition from, so there is no flash. This also avoids fragile transition-suppression hacks (`transition: none` + `requestAnimationFrame` restore) which can interfere with subsequent animations.

## Canvas positioning and sizing

The canvas renders a placeholder rectangle showing where dragged items will land. Two layout constraints must be satisfied:

### Canvas must be outside the scroll container

The canvas is positioned absolutely and draws at viewport-relative coordinates (`hoverIndex * itemHeight - scrollTop`). If the canvas is a child of the scroll container, it scrolls with the content, causing the placeholder to drift as the user scrolls during drag.

**Fix:** the canvas is a sibling of the scroll container (`parent`), not a child. The custom element itself (`<primavera-dnd>`) is the positioning context (`position:relative; display:block`). The DOM structure is:

```
<primavera-dnd style="position:relative; display:block; height:100%">
  <div class="dnd-parent" style="overflow-y:auto; height:100%">
    <div role="listbox">...</div>
  </div>
  <canvas style="position:absolute; top:0; left:0; z-index:1; pointer-events:none" />
</primavera-dnd>
```

The canvas CSS dimensions are set explicitly via a `ResizeObserver` on the scroll container's `contentRect` (viewport size, not scroll height). This ensures the canvas covers exactly the visible area.

## Mouse event ordering: mousedown vs click

`mousedown` fires before `click`. If `mousedown` unconditionally selects or sets up drag state, it will clobber the existing selection before `click` can inspect shift/cmd modifiers.

**Implementation note:** `mousedown` should bail early when shift or the platform modifier key (cmd on macOS, ctrl on Windows/Linux) is held. Let `click` handle all modified clicks (shift+click for extend, cmd/ctrl+click for toggle). `mousedown` only handles plain clicks — selecting unselected items and setting up drag initiation state.

### Placeholder height matches item height

The placeholder is a filled rectangle the full height of one item, not a thin line. The canvas must receive `itemHeight` and draw with `fillRect(0, y, canvasWidth, itemHeight)`. This gives clear visual feedback of the drop slot size.

## Drag overlay: row container styling

The `role="option"` container provides the row's dimensions and positioning within the list, but the consumer's renderer only mounts content *inside* it. When the overlay clones these elements for the drag stack, the clones are removed from the list layout context — they lose their width, and have no background, making them appear as floating unstyled content.

**Fix:** the `role="option"` container should apply baseline visual properties that travel with it when cloned:

- `width: 100%` (already set via `left:0; right:0`)
- `height: itemHeight` (already set)
- `background: var(--dnd-row-bg, transparent)` — a CSS custom property the consumer sets to define the row background. Defaults to transparent so it's opt-in.

The component should apply this background directly on the `role="option"` element at mount time. This ensures drag overlay clones inherit a visible background without the renderer needing to know about drag concerns.

### Overlay inherits resolved styles, not CSS vars

The drag overlay is appended to `<body>`, outside the component's DOM subtree. CSS custom properties scoped to the component (e.g. `--dnd-select-bg`) will not cascade into the overlay. At drag start, resolve computed styles (background, etc.) from the source elements and apply them as concrete values on the overlay wrappers.

## Scroll-to-key animation

The spec calls for smooth scrolling when an off-screen item is selected. Browser-native `scrollTo({ behavior: "smooth" })` is too slow and not tuneable. Use a custom `requestAnimationFrame` lerp instead: each frame, close 35% of the remaining distance (`scrollTop += diff * 0.35`), snapping when `|diff| < 1px`. Cancel any in-flight scroll raf when a new scroll target is set or on disconnect.

### CSS custom property convention

All component-level styling hooks use the `--dnd-*` namespace (e.g. `--dnd-row-bg`, `--dnd-drag-shadow`, `--dnd-placeholder-color`). No per-instance namespace segment is needed — consumers can scope overrides to specific instances using standard CSS selectors on any ancestor or the `<primavera-dnd>` element itself.
