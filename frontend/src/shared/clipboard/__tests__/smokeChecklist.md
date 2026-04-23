# Universal Copy/Paste — QA Smoke Checklist

Run these manually in Chromium (not Firefox) before each release.

## Designer
- [ ] Designer copy & paste round-trip (same doc)
- [ ] Designer copy & paste round-trip (cross doc, expression remap)
- [ ] Paste as Style to a selected shape
- [ ] Paste as Style+Layout to a selected shape
- [ ] Paste as New Graphic from designer home

## Cross-context transfers
- [ ] Designer → chart pane: points flow silently
- [ ] Chart series → designer: Paste as Points creates text blocks
- [ ] Table pane → chart pane: points flow silently

## Console
- [ ] Workspace empty area + shapes clipboard: Temporary Graphic pane appears
- [ ] Temporary Graphic pane: "Save as graphic…" persists to DB and swaps id

## Expression builder
- [ ] Expression builder: points onto avg() → args
- [ ] Expression builder: points onto () → chained +
- [ ] Expression builder: points on empty → loose tiles

## Other contexts
- [ ] Most Recent Alarms from forensics → populates filters
- [ ] Paste as Text into an input field

## Clipboard slots
- [ ] Ctrl+Alt+V uses previous slot
- [ ] Status indicator reflects both slots

## Menu / tooltip
- [ ] Tooltips on greyed menu items match target rejection text

## Selection mechanics
- [ ] Selection persists across module navigation
- [ ] Ctrl+A, Ctrl+Click, Shift+Click, Alt+Click+drag all behave per spec
- [ ] Marquee fully-contained behavior (not touched-by-rect)
