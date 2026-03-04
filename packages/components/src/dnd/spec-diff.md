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
- If `visualIdx >= hoverIndex`: `top = (visualIdx * itemHeight) + (draggedCount * itemHeight)`
- Otherwise: `top = visualIdx * itemHeight`

This shifts all items at or below the hover slot down by exactly the height of the dragged items, opening a gap.

### Placeholder

The canvas placeholder line is drawn at `hoverIndex * itemHeight - scrollTop`. When the pointer leaves the parent, both the placeholder and nudge offsets are removed.

## Drag end: item re-mount

During drag, dragged items are hidden (`opacity: 0`, `pointer-events: none`) but remain in the DOM with their **pre-drag** `top` value. Since items have `transition: top 0.15s ease`, restoring visibility after the move op causes a visible flash — the item appears at its old position and animates to the new one.

**Fix:** when drag ends, remove dragged items from the DOM (and the rendered item cache) **before** clearing drag state and calling `renderList()`. The render pass then re-mounts them as fresh elements at their correct new position. Fresh mounts have no prior `top` to transition from, so there is no flash. This also avoids fragile transition-suppression hacks (`transition: none` + `requestAnimationFrame` restore) which can interfere with subsequent animations.
