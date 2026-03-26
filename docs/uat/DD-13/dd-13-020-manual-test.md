# DD-13-020 Manual Browser Testing Guide

## Quick Reference

**Feature:** WYSIWYG font-family toolbar selector in Log Editor
**URL:** http://localhost:5173/log
**Expected Behavior:** When editing a WYSIWYG segment, a font-family dropdown should appear in the toolbar allowing selection from 6 font families, and selecting a font should change the appearance of typed or selected text.

---

## Pre-Test Checklist

- [ ] DevTools open (F12)
- [ ] Console tab visible (to watch for errors)
- [ ] Network tab visible (to check for API calls)
- [ ] Frontend dev server running: http://localhost:5173 responds
- [ ] Backend API running: http://localhost:3000 responds
- [ ] You have admin credentials (admin/admin by default)

---

## Test Scenario 1: Module Load

### Setup
```
Navigate to: http://localhost:5173/log
Wait: 3 seconds for page to fully load
```

### Verification
- [ ] Page loads without error boundary
- [ ] No "Something went wrong" error message
- [ ] Console shows no red error messages
- [ ] URL is http://localhost:5173/log (or /log/instance-id if redirected to an instance)

### Result
- **PASS** — Page renders cleanly
- **FAIL** — Error page, blank screen, or console errors
- **SKIP** — Can't access module

**Screenshot:** If FAIL, capture the error message

---

## Test Scenario 2: Create or Locate a Log Instance

### Setup
Look for one of these paths:
1. **If templates exist:** Click "Create Instance" button → Select template → Click "Create"
2. **If no templates:** Skip to next module (you can't test without template)
3. **If instance list visible:** Click on an existing instance to open it

### Verification
- [ ] You can create a new instance OR open an existing one
- [ ] The instance detail page loads
- [ ] You see a form with editable areas (the segments)

### Result
- **PASS** — Instance detail page shows, has editable areas
- **FAIL** — Can't find templates, can't create instance, page crashes
- **SKIP** — No templates exist in the system

**Screenshot:** Capture the instance detail page

---

## Test Scenario 3: Locate the LogEditor Component (WYSIWYG Segment)

### Setup
On the instance detail page, look for:
- A large text edit area (textarea or contenteditable div)
- A toolbar above it with formatting buttons (B, I, U, S, H1, H2, H3, List buttons)
- A color picker (usually shown as a circle or "A" with color box)

### Verification
- [ ] You can identify the text editor area
- [ ] The toolbar is visible above the editor
- [ ] At least 3 formatting buttons are present (Bold, Italic, Underline, etc.)

### Result
- **PASS** — LogEditor is visible and interactive
- **FAIL** — No editor visible, toolbar missing, buttons don't respond to click
- **SKIP** — Instance has no WYSIWYG segments, only field tables or other types

**Screenshot:** Capture the full editor with toolbar visible

---

## Test Scenario 4: Identify the Font-Family Selector

### Setup
In the toolbar, scan from left to right:
- Text formatting buttons (B, I, U, S)
- Separator (thin vertical line)
- Heading buttons (H1, H2, H3)
- Separator
- List buttons (Bullet, Numbered)
- Separator
- Image, Table buttons
- Text color picker (circle with "A" label)
- Separator
- **← Font-family selector should be here**

### Verification
Look for a `<select>` dropdown element:
- [ ] Dropdown is positioned after the color picker
- [ ] Dropdown text shows "Inter" or similar when clicked
- [ ] Title/tooltip says "Font family" (on hover)
- [ ] No disabled attribute (should be clickable)
- [ ] Currently shows an option name (default is likely "Default" or empty)

### Inspection (DevTools)
```javascript
// Run this in browser console to verify the selector exists:
const selector = document.querySelector('select[title="Font family"]');
if (selector) {
  console.log('Font selector found!');
  console.log('Current value:', selector.value);
  console.log('Options:', Array.from(selector.options).map(o => o.text));
} else {
  console.log('Font selector NOT found');
}
```

### Result
- **PASS** — Dropdown visible, has title="Font family", options are populated
- **FAIL** — Dropdown missing, disabled, or has wrong options
- **SKIP** — Can't get to LogEditor (test earlier steps first)

**Screenshot:** Zoom in on the toolbar and capture the dropdown area

**Console Output:** Paste the output of the JavaScript inspection above

---

## Test Scenario 5: Test Font Selection and Apply

### Setup
```
1. Click in the editor text area to focus
2. Type: "Font Family Test"
3. Select all text (Ctrl+A)
4. Do NOT click anything yet (keep text selected)
```

### Verification (Step 1: Check Current Font)
- [ ] Text is selected (highlighted)
- [ ] No errors in console
- [ ] Toolbar buttons respond to hover (colors change)

### Apply Monospace Font
```
5. Click the font-family dropdown
6. Choose "Monospace" from the list
7. Click outside or press Escape to deselect text
```

**Expected:** Text should now appear in a monospace font (noticeably different from default).

### Verification (Step 2: Visual Check)
- [ ] Dropdown opened when clicked
- [ ] "Monospace" option was visible and clickable
- [ ] Text changed appearance after selection
- [ ] Text is now in a monospace font (fixed-width, like code)
- [ ] No console errors

### Inspection (DevTools)
```javascript
// Check what font is applied to the editor content
const editor = document.querySelector('[data-test-id="log-editor"]') ||
               document.querySelector('.tiptap') ||
               document.querySelector('[contenteditable="true"]');
if (editor) {
  const text = editor.querySelectorAll('*');
  const fonts = [];
  text.forEach(el => {
    const font = window.getComputedStyle(el).fontFamily;
    if (font && !fonts.includes(font)) fonts.push(font);
  });
  console.log('Fonts in editor:', fonts);
} else {
  console.log('Could not find editor element');
}
```

### Result
- **PASS** — Text visibly changes to monospace, no errors
- **FAIL** — Dropdown didn't open, text didn't change, or console error
- **SKIP** — Can't locate font selector (test Scenario 4 first)

**Screenshot:** Capture the editor with monospace text applied

**Console Output:** Paste the computed font family output

---

## Test Scenario 6: Test Multiple Font Switches

### Setup
The monospace text is still visible.

```
1. Select all text again (Ctrl+A)
2. Click font-family dropdown
3. Choose "Georgia, serif"
4. Click outside to deselect
5. Take screenshot
6. Select all again (Ctrl+A)
7. Click font-family dropdown
8. Choose "Inter, sans-serif"
9. Click outside to deselect
```

### Verification
- [ ] Each font change applies immediately
- [ ] Text visibly changes with each selection
- [ ] No console errors
- [ ] No lag or unresponsive behavior

**Font Descriptions:**
- Monospace: Fixed-width, like code, every character same width
- Georgia, serif: Has little feet/serifs on letters, serif typeface
- Inter, sans-serif: Smooth, modern sans-serif, no feet

### Result
- **PASS** — All three fonts visible and distinct
- **FAIL** — Fonts don't change, or change doesn't persist
- **SKIP** — Font selector not working (test Scenario 5 first)

**Screenshot:** Capture each font state (three screenshots recommended)

---

## Test Scenario 7: Test Default Font Reset

### Setup
Text is currently in "Inter, sans-serif".

```
1. Select all text (Ctrl+A)
2. Click font-family dropdown
3. Choose "Default"
4. Click outside to deselect
```

### Verification
- [ ] Text reverts to the default font
- [ ] Default font matches other toolbar buttons and page text
- [ ] No console errors

### Inspection
```javascript
const editor = document.querySelector('[contenteditable="true"]') ||
               document.querySelector('.tiptap');
if (editor) {
  const style = window.getComputedStyle(editor);
  console.log('Editor base font:', style.fontFamily);
}
```

### Result
- **PASS** — Text reverts to default, matches page theme
- **FAIL** — Text doesn't change, or shows wrong font
- **SKIP** — Font selector not working (test Scenario 5 first)

**Screenshot:** Capture text in default font

---

## Test Scenario 8: Type New Text in Current Font

### Setup
Text is in "Inter, sans-serif" (from Scenario 6, step 8).

```
1. Click at the end of the existing text
2. Press Enter to create new line
3. Type: "New text in Inter"
4. Take screenshot
```

### Verification
- [ ] New text appears in the same font (Inter)
- [ ] Text is editable (no read-only mode)
- [ ] Cursor is visible and responsive

### Result
- **PASS** — New text inherits the applied font
- **FAIL** — New text ignores font setting, or appears in default
- **SKIP** — Can't type (editor not focused or read-only)

**Screenshot:** Capture the editor with new text

---

## Test Scenario 9: Verify No Errors During Extended Use

### Setup
You've done 8 scenarios of font changes, typing, and selections.

### Verification (DevTools Console)
- [ ] Console tab shows NO red error messages
- [ ] No warnings about missing Tiptap extensions
- [ ] No network errors (Network tab shows all requests as 200/201/204)

### Common Errors to Look For
- `Uncaught TypeError: Cannot read property 'setFontFamily' of null`
- `Extension ... not found in editor`
- `POST /api/logs/instances 403 Forbidden` (auth error)
- `POST /api/logs/instances 500 Internal Server Error` (backend error)

### Result
- **PASS** — Console is clean, no errors
- **FAIL** — One or more errors visible
- **SKIP** — Can't access console

**Screenshot:** Capture the console showing no errors

---

## Test Scenario 10: Verify Toolbar Dropdown Options

### Setup
Font-family dropdown is visible and accessible.

```
1. Click the font-family dropdown
2. Do NOT select anything
3. Count the visible options
4. Take screenshot
```

### Verification
- [ ] Dropdown shows at least 5 options
- [ ] Options include: Default, Inter, Serif, Monospace, Arial, Georgia
- [ ] Order matches spec (Default first, then named fonts)
- [ ] All options are clickable (not disabled)

### Result
- **PASS** — All 6 expected options present and functional
- **FAIL** — Missing options, wrong order, or options disabled
- **SKIP** — Dropdown not found or won't open

**Screenshot:** Capture the open dropdown with all options visible

---

## Summary Table

| Test Scenario | Pass/Fail | Notes |
|---------------|-----------|-------|
| 1. Module Load | | |
| 2. Create/Locate Instance | | |
| 3. Find LogEditor | | |
| 4. Identify Font Selector | | |
| 5. Apply Monospace Font | | |
| 6. Switch Between Fonts | | |
| 7. Reset to Default | | |
| 8. Type New Text in Font | | |
| 9. No Console Errors | | |
| 10. Verify All Options | | |

**Overall Result:**
- [ ] **PASS** — All 10 scenarios passed
- [ ] **PARTIAL** — Some scenarios passed, some failed
- [ ] **FAIL** — Most or all scenarios failed

---

## How to Report Results

After completing all tests:

1. **Count results:**
   - How many scenarios PASSED?
   - How many FAILED?
   - How many SKIPPED?

2. **Note specific failures:**
   - Which test step failed?
   - What was expected vs. what you saw?
   - Any error messages?

3. **Attach screenshots:**
   - Save all screenshots to `/home/io/io-dev/io/docs/uat/DD-13/`
   - Name them: `dd-13-020-test{N}-{status}.png`
   - Example: `dd-13-020-test5-fail-no-monospace.png`

4. **Update CURRENT.md:**
   - Change verdict to: pass / partial / fail
   - Fill in scenarios_tested, scenarios_passed, scenarios_failed
   - Add screenshot notes explaining any failures

5. **Re-run UAT:**
   ```bash
   uat human DD-13-020
   ```

---

## Quick Debugging Reference

### If font selector is missing:
- Check that you're in a WYSIWYG segment (not field_table or field_list)
- Check that LogEditor is not in readOnly mode
- Run: `document.querySelector('select[title="Font family"]')` in console — should return an element, not null

### If fonts don't change:
- Check console for errors (Ctrl+Shift+I → Console)
- Verify Tiptap FontFamily extension is loaded
- Try selecting text again and selecting a different font

### If editor is read-only:
- Check that you have log:write permission
- Check that the instance status is "draft" or "in_progress" (not "reviewed" or "submitted")

### If templates don't exist:
- You need a log template first
- Ask: Is there a "Settings" or "Templates" section in the Log module?
- Or: Try creating a template through the API:
  ```bash
  curl -X POST http://localhost:3000/api/logs/templates \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"Test","segment_ids":["..."],"is_active":true}'
  ```

---

**Last Updated:** 2026-03-26
**Test Duration:** ~15 minutes expected
**Difficulty:** Easy — mostly visual verification, no complex workflows required
