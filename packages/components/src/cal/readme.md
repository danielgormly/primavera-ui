## @primavera-ui

DOM-backed vanilla JS calendar. Currently monthly view only.

- consider adding back stats-js

## Roadmap
- [] All-day rendering should not occur when message returns but on RAF!!!
- [] Change UI of label when all-day view expanded contracted
- [] Jump to date/today button in tweakpane
- [] Filter by multiple calendars, colour
- [] Worker fix in built version

## Cal Interactions
- [] hover style event extends to next day as needed
- [] Dragging 24hr events left/right
- [] Dragging 24hr events start/finish
- [] Click event to select / bring to front
- [] Drag and drop calendar events
- [] tap to highlight neat 15min interval (to create new event)
- [] drag to highlight new area (15min factor) (to create new event)
- [] Click/drag to shorten/lengthen event each direction
- [] Click/Context click consumer events
- [] Drag (+ shift) on blank area to multiselect
- [] Move between weeks/days with a button
- [] Month/Year that shows up on pan

## Times & time zones
- [] Change between 12/24hr time
- [] Change time zone
- [] Add time zone
- [] Events falling on DST borders... move for recurring events..? or show that it's a fake or additional hour etc

## Repeating events
- [] Repeating events (intial series)
- [] Changing repeated events (future events, all events or only this event)
- [] Overwriting repeated events (use indexed system)

## Orientation
- [] Consider: Hover over date to see full date ?
- [] Maybe show month (3 day version) for every monday, and every 1st, so context is extremely obvious

## final optimisations / quality udpates / future plans
- [] Bug: Sometimes the overflow events first thing in the morning sit above succeeding events
- [] UX: Reconsider ALL events extending entire grid; consider opposite.
- [] event/worker tests
- [] True monthly, annual view
- [] Multi-select events with single click
- [] custom scroller, snap to date or week when active scrolling stops
- [] Scroll snap type (?)
- [] All-day: Update not if dates change, but if data changes
