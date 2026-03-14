# Inside/Operations - Expression Builder

## 1. Overview

The Expression Builder is a **shared UI component** used across 6 contexts in Inside/Operations. It provides a uniform drag-and-drop tile interface for constructing mathematical and logical expressions. One engine, one UI component, one AST format, one evaluation pipeline — the only thing that changes between contexts is the **input catalog** (what variables and data sources are available as tiles). See doc 32 (Shared UI Components) for the Expression Builder Modal specification.

### Use Cases

The Expression Builder is used in the following contexts (see Section 3 for detailed input catalogs):

1. **Point Configuration** — Custom conversions, calculated points, derived values
2. **Alarm/Threshold Definitions** — Complex alarm conditions, multi-point voting logic, cross-source correlation
3. **Rounds Checkpoints** — Compound measurements, unit conversions, deviation checks against live OPC values
4. **Log Segments** — Calculated fields within log templates, auto-populated summary values
5. **Dashboard/Report Widgets** — Calculated KPIs, derived metrics, custom aggregations
6. **Forensics** — Derived time series for correlation analysis

---

## 2. Component Architecture

### React Component

The Expression Builder appears as a modal overlay (defined in doc 32) that adapts its input catalog based on the invoking context. The tile-based drag-and-drop interface is the same everywhere — only the available input tiles change.

```typescript
<ExpressionBuilder
  context="point_config"          // See Section 3 for all 6 contexts
  contextLabel="Custom Conversion"
  contextPointId={pointId}       // The "current point" when opened from a point context (optional)
  contextObjectId={objectId}     // Generic context object ID (checkpoint, segment, widget, etc.)
  contextObjectName="TI-101.PV"  // Display name for the context object
  initialExpression={savedAst}   // Pre-populate with existing expression (for editing)
  onApply={(ast, meta) => ...}   // Called when user clicks OK and expression passes validation
  onCancel={() => ...}           // Called when user cancels
/>
```

### State Management

Internal state is managed with React `useReducer` for undo/redo support:

- **Workspace tiles**: The ordered tree of tiles representing the expression
- **Selection state**: Set of selected tile IDs
- **Cursor position**: Current insertion point `{ parentId: string | null, index: number }`
- **Clipboard**: Copied tile subtree(s)
- **Undo/redo stacks**: Command history (max 50 operations)
- **Validation state**: Current validation errors/warnings

### Integration Pattern

Modules invoke the builder by rendering the component in a modal:

```typescript
// In any module that needs expression building
const [showBuilder, setShowBuilder] = useState(false);

{showBuilder && (
  <ExpressionBuilder
    context="conversion"
    contextPointId={selectedPoint.id}
    contextObjectName={selectedPoint.tagname}
    onApply={(ast, meta) => {
      applyConversion(selectedPoint.id, ast, meta);
      setShowBuilder(false);
    }}
    onCancel={() => setShowBuilder(false)}
  />
)}
```

---

## 3. Context-Dependent Input Catalogs

The expression builder is invoked from 6 different contexts. Each context provides a different **input catalog** — the set of variables, data sources, and functions available as tiles in the palette. The expression builder filters the tile palette to show only inputs relevant to the current context.

The `context` prop determines which input catalog is loaded. The evaluation engine, AST format, UI mechanics, and validation rules are identical across all contexts.

### 3.1 Point Configuration

**Context value**: `point_config`

**Available inputs**:
- OPC points (by tag/name search) — includes "Current Point Value" variable
- Constants (numeric literals)
- Time functions (`now`, `elapsed_since`)

**Use cases**: Custom unit conversions, calculated points, derived values from one or more source points.

**Output type**: Numeric value stored as the point's calculated value.

**Invoked from**: Settings Module (doc 15) — point configuration UI, "Custom Conversion" button.

### 3.2 Alarm/Threshold Definitions

**Context value**: `alarm_definition`

**Available inputs**:
- OPC points (by tag/name search)
- Other alarm definition values (reference thresholds from the same or other alarm definitions)
- Constants (numeric literals)
- Boolean literals (True/False)
- Boolean operators (AND, OR, NOT)
- Time functions (`now`, `elapsed_since`, `duration_above`, `duration_below`)

**Use cases**: Complex alarm conditions that go beyond simple HH/H/L/LL thresholds — multi-point logic (2-of-3 voting), cross-source correlation, conditional alarms.

**Output type**: Boolean (alarm active/inactive) or numeric (compared against thresholds set in the alarm definition).

**Example**: `(point_a > 100 AND point_b > 100) OR (point_a > 100 AND point_c > 100) OR (point_b > 100 AND point_c > 100)` — 2-of-3 voting logic.

**Invoked from**: Point configuration alarm tab — the "Expression" path (vs. the simple threshold wizard). See doc 27 (Alert System).

### 3.3 Rounds Checkpoints

**Context value**: `rounds_checkpoint`

**Available inputs**:
- Checkpoint fields (for multi-field calculations) — referenced by field name within the checkpoint definition
- OPC points (by tag/name search) — for cross-referencing manual readings vs live values
- Constants (numeric literals)

**Use cases**:
- **Compound measurements**: feet/inches/eighths to decimal — `field_feet + (field_inches / 12) + ((field_eighths / 8) / 12)`
- **Unit conversions**: MMSCF to MBTU, or field units to standard
- **Deviation check**: Compare manual reading to live OPC value, flag if deviation exceeds threshold — `Abs(field_reading - point_TI101) > (point_TI101 * 0.05)` (5% deviation)

**Output type**: Numeric calculated value (stored alongside raw field values), or boolean (pass/fail deviation check).

**Important**: Raw field values are ALWAYS stored. The expression produces a calculated value used for range checks, reporting, and alarm thresholds. Both raw and calculated values are persisted.

**Invoked from**: Rounds template configuration — checkpoint definition UI. See doc 14 (Rounds Module).

### 3.4 Log Segments

**Context value**: `log_segment`

**Available inputs**:
- Segment field values — referenced by field name within the segment definition
- OPC points (by tag/name search) — for point-data segments
- Constants (numeric literals)

**Use cases**: Calculated fields within log templates (e.g., total production = sum of unit productions), auto-populated summary values.

**Output type**: Numeric or text value displayed in the log entry.

**Invoked from**: Log template configuration — segment field definition UI. See doc 13 (Log Module).

### 3.5 Dashboard/Report Widgets

**Context value**: `widget`

**Available inputs**:
- OPC points (by tag/name search)
- Aggregation functions (`time_bucket_avg`, `time_bucket_sum`, `time_bucket_min`, `time_bucket_max`, `time_bucket_count`)
- Time range functions (`range_start`, `range_end`, `range_duration`)
- Constants (numeric literals)

**Use cases**: Calculated KPIs, derived metrics for widget display, custom aggregations beyond what standard widgets provide.

**Output type**: Numeric value for widget display.

**Invoked from**: Widget configuration in Designer (doc 09) when designing dashboards or reports. See docs 10 (Dashboards) and 11 (Reports).

### 3.6 Forensics

**Context value**: `forensics`

**Available inputs**:
- OPC points (by tag/name search) — for constructing derived series from existing point data
- Time functions (`now`, `elapsed_since`)
- Constants (numeric literals)

**Use cases**: Create derived time series to include in correlation analysis. E.g., "point_a minus point_b" as a synthetic series, or a ratio of two points over time.

**Output type**: Time series of numeric values (expression is evaluated per data point across the selected time range).

**Invoked from**: Forensics analysis workspace — "Add Calculated Series" action. See doc 12 (Forensics Module).

### 3.7 Input Catalog Summary

| Context | OPC Points | Checkpoint Fields | Segment Fields | Aggregation Fns | Time Fns | Boolean Logic | Output |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|--------|
| `point_config` | Yes | — | — | — | Yes | — | Numeric |
| `alarm_definition` | Yes | — | — | — | Yes | Yes | Boolean / Numeric |
| `rounds_checkpoint` | Yes | Yes | — | — | — | — | Numeric / Boolean |
| `log_segment` | Yes | — | Yes | — | — | — | Numeric / Text |
| `widget` | Yes | — | — | Yes | Yes | — | Numeric |
| `forensics` | Yes | — | — | — | Yes | — | Numeric (time series) |

---

## 4. UI Layout

### Window Structure

The Expression Builder opens as a modal dialog, centered in the viewport with a semi-transparent backdrop.

```
+============================================================================+
|  Expression Builder - Custom Conversion                            [X]     |
+============================================================================+
|                                                                            |
|  Name: [________________________]  Description: [________________________] |
|                                                                            |
|  [x] Save for Future Use   [ ] Share with Other Users (Admin only)         |
|                                                                            |
|  Return Value:                                                             |
|  (o) Floating Point (Decimal) - Precision: [3 v]                           |
|  ( ) Integer (truncate decimal)                                            |
|                                                                            |
+--- Tile Palette ----------------------------------------------------------|
|                                                                            |
|  Values:    [Point Ref v] [Enter Value]                                    |
|  Operators: [+] [-] [*] [/] [%] [X^Y]                                     |
|  Functions: [( )] [Square()] [Cube()] [Round() v] [Neg()] [Abs()]          |
|  Compare:   [>] [<] [>=] [<=]                                             |
|  Control:   [If () Then () Else ()]                                        |
|                                                                            |
+--- Workspace -------------------------------------------------------------|
|                                                                            |
|  +-----+ +---+ +-----+ +---+ +------+                                     |
|  | x   | | + | |  5  | | * | |  47  |    (drag tiles here)                |
|  +-----+ +---+ +-----+ +---+ +------+                                     |
|                                                                            |
+--- Expression Preview (collapsible) --------------------------------------|
|  = (x + 5) * 47                                                    [Hide] |
+----------------------------------------------------------------------------|
|                                                                            |
|                              [Test]   [OK]   [Cancel]                      |
|                                                                            |
+============================================================================+
```

### Dimensions and Responsive Behavior

- **Default size**: 900px wide x 700px tall (adjusts to viewport)
- **Minimum usable size**: 600px wide x 500px tall
- **Below minimum**: Display error message "Window is too small for the Expression Builder. Please increase your browser window size or reduce zoom level."
- **Maximum**: 90% of viewport width, 90% of viewport height

### Workspace Sizing Rules

1. Workspace has a minimum height of one tile row (60px + padding)
2. As tiles are added and wrap to new rows, workspace expands vertically
3. Workspace expands up to 3 rows of tiles using the modal's own scrollbar
4. Beyond 3 rows, the workspace gets its own internal scrollbar
5. If the modal is too small for even one row, the modal scrollbar handles all overflow

### Header Fields

- **Name**: Text input, max 255 characters. Required if "Save for Future Use" is checked. Grayed out if Save is unchecked.
- **Description**: Text input, optional. Grayed out if Save is unchecked.

### Save/Share Checkboxes

- **Save for Future Use**: Checked by default. Unchecking disables Name and Description fields.
- **Share with Other Users**: Unchecked by default. Only visible/enabled for users with `system:expression_manage` permission (Admin role). When checked, the saved expression is visible to all users.

### Output Configuration

- **Floating Point (Decimal)**: Default. Precision dropdown: 0-7 decimal places, default 3.
- **Integer**: Truncates (does not round). Selecting Integer hides the precision dropdown.

---

## 5. Tile Definitions

All tiles have a fixed height of 60px (meeting the 60px touch target for gloved operation). Width is content-determined with a minimum of 60px (square).

### 5.1 Value Tiles

#### Point Reference

```
+--------------------------+
|  Point Ref          [v]  |
|  (Current Point Value)   |
+--------------------------+
```

- **Palette label**: "Point Ref"
- **Default state**: "Current Point Value" -- a variable that resolves to whatever point the expression is applied to. This makes expressions reusable across different points.
- **Dropdown/selector**: Click the dropdown to either:
  - Select "Current Point Value" (default, variable)
  - Open a point search dialog to pick a specific point by tagname or description
- **When a specific point is selected**: Tile displays the point's tagname (e.g., "TI-101.PV")
- **Multiple instances**: Can be placed multiple times in the workspace, each referencing a different point
- **Tile category color**: Operand (blue-gray)

#### Enter Value

```
+-------------------+
|  [ 47.5        ]  |
+-------------------+
```

- **Palette label**: "Enter Value"
- **Behavior**: Contains an inline text input. User types a numeric value.
- **Validation**: Must be a valid number (integer or decimal). Non-numeric input shows red border.
- **Multiple instances**: Each instance has its own independent value
- **Tile category color**: Operand (blue-gray)

### 5.2 Operator Tiles

All operator tiles are 60x60px (square). They expect one operand to the left and one to the right.

| Tile | Display | Operation |
|------|---------|-----------|
| Add | **+** | Left + Right |
| Subtract | **-** | Left - Right |
| Multiply | **\*** | Left * Right |
| Divide | **/** | Left / Right |
| Modulus | **mod** | Remainder of Left / Right |
| Power | **x**^**y** | Left raised to the Right power (displayed with superscript y) |

**Tile category color**: Arithmetic operator (green)

### 5.3 Comparison Tiles

All comparison tiles are 60x60px. They return 1 (true) or 0 (false).

| Tile | Display | Returns 1 if |
|------|---------|-------------|
| Greater Than | **>** | Left > Right |
| Less Than | **<** | Left < Right |
| Greater or Equal | **>=** | Left >= Right |
| Less or Equal | **<=** | Left <= Right |

**Tile category color**: Comparison (amber)

### 5.4 Container/Function Tiles

These tiles have parentheses that accept nested tiles. They expand horizontally and vertically to contain their children.

#### Parentheses Group

```
+--- ( ------------------------------- ) ---+
|   [child tiles arranged here]              |
+--------------------------------------------+
```

- **Palette label**: "( )"
- **Behavior**: Groups tiles for order-of-operations control
- **Display**: Left and right parenthesis delimiters with children between them

#### Square

```
+--- Square ( ------------------------ ) ---+
|   [child tiles]                            |
+--------------------------------------------+
```

- **Palette label**: "Square( )"
- **Behavior**: Squares (multiplies by itself) the result of the expression inside
- **Equivalent to**: child_result * child_result

#### Cube

- **Palette label**: "Cube( )"
- **Behavior**: Cubes the result of the expression inside
- **Equivalent to**: child_result * child_result * child_result

#### Round

```
+--- Round ( ---------------------- ) [1 v] --+
|   [child tiles]                     dropdown |
+----------------------------------------------+
```

- **Palette label**: "Round( )"
- **Behavior**: Rounds the result to the nearest increment specified by the dropdown
- **Dropdown values**: 0.0000001, 0.000001, 0.00001, 0.0001, 0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000, 100000, 1000000 (powers of 10 increments)
- **Default**: 1
- **Rounding rule**: 5-9 rounds up, 1-4 rounds down (standard rounding)
- **Examples**: 5.94 rounded to 0.1 = 5.9; 5.94 rounded to 1 = 6; 5.94 rounded to 10 = 10; 5.94 rounded to 100 = 0

#### Negate

- **Palette label**: "Neg( )"
- **Behavior**: Flips the sign of the result (positive becomes negative, negative becomes positive, zero stays zero)

#### Absolute Value

- **Palette label**: "Abs( )"
- **Behavior**: Returns the absolute value (negative becomes positive, positive stays positive, zero stays zero)

**Tile category color**: Container/function -- border color determined by nesting level (see Section 6.5)

### 5.5 Control Flow Tiles

#### If-Then-Else

```
+--- If --------+--- Then -------+--- Else -------+
| [condition]   | [true result]  | [false result]  |
| [tiles]       | [tiles]        | [tiles]         |
+---------------+----------------+-----------------+
```

- **Palette label**: "If () Then () Else ()"
- **Behavior**: If the condition section evaluates to non-zero, return the Then section result. Otherwise, return the Else section result. If Else section is empty, return 0.
- **Three separate drop zones**: Condition, Then, Else -- each accepts nested tiles
- **Section labels**: "If", "Then", "Else" displayed as dividers between sections

**Tile category color**: Control flow (purple)

### 5.6 Operator Precedence

All math operations follow C-language order of operations:

1. Parentheses/function containers (innermost first)
2. Unary operators: Neg, Abs, Square, Cube
3. Exponentiation: X^Y (right-associative)
4. Multiplication, Division, Modulus: *, /, mod (left-to-right)
5. Addition, Subtraction: +, - (left-to-right)
6. Comparisons: >, <, >=, <= (left-to-right)

The visual tile arrangement with explicit parentheses/container tiles means order of operations is always unambiguous -- users explicitly group operations rather than relying on implicit precedence.

### 5.7 Palette Organization

Tiles are arranged in the palette by category with labels:

```
Values:     [Point Ref v] [Enter Value]
Operators:  [+] [-] [*] [/] [mod] [x^y]
Functions:  [( )] [Square()] [Cube()] [Round() v] [Neg()] [Abs()]
Compare:    [>] [<] [>=] [<=]
Control:    [If () Then () Else ()]
```

---

## 6. Workspace Behavior

### 6.1 Tile Placement

**Method 1 -- Click-click**: Left-click a palette tile to select it (tile highlights), then left-click inside the workspace to place it at the cursor position.

**Method 2 -- Drag-and-drop**: Left-click and hold a palette tile, drag it into the workspace. While dragging, an insertion indicator shows where the tile will land. Release to drop.

Both methods create a new instance of the tile in the workspace. Palette tiles are never consumed -- they remain available for repeated use.

### 6.2 Layout and Snapping

Tiles in the workspace are laid out using **CSS Flexbox** with `flex-direction: row` and `flex-wrap: wrap`:

- Tiles flow left-to-right like words in a paragraph
- When a row fills, tiles wrap to the next row
- 4px gap between tiles
- Tiles snap to positions in the flow -- no free-form placement
- Container tiles are themselves flex items that contain internal flex containers for their children

### 6.3 Cursor / Insertion Point

A blinking vertical line (2px wide, theme accent color) indicates the current insertion point:

- **Positioned by**: Left-clicking between tiles, or using arrow keys
- **Blink rate**: 530ms on, 530ms off (standard)
- **Can exist in**: The main workspace or inside any container tile
- **During drag**: The cursor becomes solid (non-blinking) and shows at the potential drop position
- **Arrow key behavior**:
  - Left/Right: Move cursor between tiles at the current level
  - Down: Enter a container tile (move cursor to first position inside)
  - Up: Exit current container (move cursor to position after the container in the parent level)
  - Home: Move to start of expression
  - End: Move to end of expression

### 6.4 Selection

**Single select**: Left-click a tile in the workspace to select it (highlighted border).

**Multi-select**:
- Ctrl+Left-click: Toggle individual tile selection
- Left-click empty space + drag: Create a selection rectangle. Only tiles **fully contained** within the rectangle are selected.
- Ctrl+A: Select all tiles in the workspace (when workspace has focus)
- Right-click > Select All: Same as Ctrl+A

**Deselect**: Left-click on empty workspace space (without Ctrl) or press Escape.

### 6.5 Nesting

Container tiles (parentheses, Square, Cube, Round, Neg, Abs, If-Then-Else) accept nested tiles.

**Nesting method 1**: Place a container tile, then drag individual tiles into it.

**Nesting method 2**: Select a container tile from the palette, then left-click and drag in the workspace to create a selection rectangle. All fully-contained tiles become children of the new container.

**Depth limit**: 5 levels. Attempting to drop a container beyond level 5 is blocked with a tooltip: "Maximum nesting depth (5 levels) reached."

**Visual indicators for nesting depth** (Okabe-Ito colorblind-safe palette):

| Level | Light Theme Border | Dark Theme Border | High Contrast Border Style |
|-------|-------------------|-------------------|---------------------------|
| 1 | `#0072B2` (blue) | `#56B4E9` | Solid, 2px |
| 2 | `#D55E00` (orange) | `#E69F00` | Dashed, 2px |
| 3 | `#009E73` (teal) | `#40C9A2` | Dotted, 2.5px |
| 4 | `#CC3311` (vermillion) | `#EE6677` | Double, 3px |
| 5 | `#7B2D8E` (purple) | `#AA88CC` | Solid, 3.5px |

Additional depth cues:
- Background tint: 8% opacity of the border color (10% in dark theme, 15% in high contrast)
- Progressive left-padding: 4px per nesting level
- Nesting depth badge ("L2") on container corner, visible on hover (always visible in high-contrast mode)
- Breadcrumb trail above workspace when cursor is inside a nested container (e.g., "Workspace > Parens L1 > Square L2")

**Dragging container tiles**: Left-click the container border and drag to move the entire group (container + all children).

**Rearranging within containers**: Tiles inside containers can be selected, multi-selected, dragged, copied, and pasted using the same mechanics as the main workspace.

### 6.6 Drag Feedback

When a tile is being dragged:
1. Source tile dims to 40% opacity
2. A ghost copy follows the cursor at 80% opacity
3. Tiles in the workspace shift to create a gap at the drop position (150ms animation)
4. A solid insertion line appears at the drop position
5. Container tile borders highlight (thicker, brighter) when hovered during drag to indicate they will accept the drop
6. If the drop position is invalid (e.g., would exceed nesting depth), no insertion line appears and the ghost shows a "not allowed" indicator

### 6.7 Copy, Paste, Delete

**Copy**:
- Ctrl+C or right-click > "Copy": Copies selected tile(s) to clipboard
- Right-click an unselected tile > "Copy": Copies just that tile

**Paste**:
- Ctrl+V or right-click empty workspace > "Paste": Pastes at cursor position
- If cursor is inside a container tile: pastes inside that container
- If a container tile is selected and Ctrl+V is pressed: pastes inside the selected container
- Right-click inside a container > "Paste": Pastes inside that container

**Delete**:
- Delete key: Deletes all selected tiles (with confirmation prompt)
- Right-click selected tile(s) > "Delete Tile(s)": Deletes all selected (with confirmation)
- Right-click an unselected tile > "Delete": Deletes just that tile (with confirmation)
- **All delete operations prompt**: "Delete [N] tile(s)? This cannot be undone." with "Delete" and "Cancel" buttons.

**Cut**: Ctrl+X or right-click > "Cut": Copy + Delete (with confirmation for the delete portion).

### 6.8 Undo / Redo

- **Ctrl+Z**: Undo last operation
- **Ctrl+Y** or **Ctrl+Shift+Z**: Redo
- **Stack depth**: Maximum 50 operations
- **Tracked operations**: Tile add, tile remove, tile move/reorder, value change (Enter Value), dropdown change (Round, Point Ref), paste, cut
- Undo/redo bypasses the delete confirmation prompt (undo of a delete instantly restores)

### 6.9 Context Menu (Right-Click)

**On a selected tile (or one of multiple selected tiles)**:
- Copy
- Cut
- Delete Tile(s)
- (separator)
- Select All

**On an unselected tile**:
- Copy
- Cut
- Delete
- (separator)
- Select All

**On empty workspace space**:
- Paste (if clipboard has content)
- Select All

**Inside a container tile (empty area)**:
- Paste (inside this group)
- Select All (inside this group)

**On a container tile border**:
- Copy Group
- Cut Group
- Delete Group

---

## 7. Expression Preview

A collapsible panel below the workspace displays a read-only text representation of the expression:

```
= ((Current Point Value + 5) * 47) / 100
```

- **Displayed by default**. Users can collapse/hide it via a toggle.
- Updates in real-time as tiles are added, removed, or rearranged.
- Point references display as tagnames (e.g., "TI-101.PV") or "Current Point Value" for the variable.
- Uses `role="math"` for accessibility with `aria-label` providing the full spoken expression.
- Read-only -- cannot be edited directly (changes are made via tiles only).
- If the expression has validation errors, the preview shows the error location highlighted in red.

---

## 8. Expression Validation

### 8.1 Real-Time Validation

Validation runs continuously as tiles are placed:
- **On tile drop**: Validate local context around the dropped tile immediately
- **On tile removal**: Re-validate adjacent tiles
- **Debounced full validation**: 300ms after any change, run complete expression validation

### 8.2 Validation Rules

| Rule | Description | Severity |
|------|-------------|----------|
| EXPRESSION_NOT_EMPTY | Workspace must contain at least one tile | Error |
| NO_ADJACENT_OPERATORS | Binary operators cannot be next to each other | Error |
| OPERAND_REQUIRED_LEFT | Binary operators need an operand on the left | Error |
| OPERAND_REQUIRED_RIGHT | Binary operators need an operand on the right | Error |
| NO_ADJACENT_OPERANDS | Two operands cannot be adjacent without an operator | Error |
| CONTAINER_NOT_EMPTY | Container tiles should have at least one child | Warning |
| DIVISION_BY_ZERO_LITERAL | Division by literal value 0 | Warning |
| IF_CONDITION_REQUIRED | If-Then-Else must have a condition | Error |
| IF_THEN_REQUIRED | If-Then-Else must have a Then section | Error |
| NESTING_DEPTH_EXCEEDED | Nesting cannot exceed 5 levels | Error (prevent drop) |
| EXPRESSION_RESULT_DEFINED | Expression must produce a value | Error |
| ENTER_VALUE_EMPTY | Enter Value tile has no value entered | Error |
| POINT_REF_UNRESOLVED | Specific point reference cannot be found | Warning |

### 8.3 Visual Error Indicators

- **Error (red)**: Red dashed border on offending tile. Pulsing "?" placeholder where operand is missing. Test/OK buttons disabled.
- **Warning (amber)**: Amber border. Test/OK buttons remain enabled.
- **Info (blue)**: Subtle indicator. Always enabled.

### 8.4 Prevention vs Detection

Hard blocking (prevent drop) only for:
- Nesting depth > 5

Soft prevention (show warning, allow the action) for everything else. Users may be in an intermediate state while rearranging tiles.

---

## 9. Test & Performance Validation

### 9.1 Test Button Behavior

**When opened from a point context** (e.g., custom conversion for TI-101.PV):

The Test button opens a dialog:
```
The current value of TI-101.PV is 95.
After the expression, the result is: 47.000

---
Test custom value: [________] [Test]
```

If the expression references other specific points, their current values are fetched and displayed.

**When opened from a non-point context** (e.g., UOM conversion):
```
Enter a test value for "Temperature Conversion": [________] [Test]
```

### 9.2 Performance Benchmarking

When a test is run, the system:

1. Compiles the tile arrangement into an evaluable expression
2. Runs the evaluation **10,000 times** to get reliable timing
3. Calculates average time per evaluation

**Performance thresholds**:

| Result | Message |
|--------|---------|
| < 0.1ms avg | "Expression evaluates in ~X microseconds. Performance is excellent." (green) |
| 0.1ms - 1ms | "Expression evaluates in ~X microseconds. Performance is acceptable." (yellow) |
| 1ms - 10ms | "Expression evaluates in ~X milliseconds. This may impact real-time display performance. Consider simplifying." (orange) |
| > 10ms or timeout | "Expression is too complex or slow for real-time use." (red) |

**Error detection**: If the expression produces Infinity, NaN, or throws during evaluation, report the error and suggest checking the formula.

**Timeout**: Benchmarking runs in a **Web Worker** with a 5-second timeout. If the worker does not complete in 5 seconds, it is terminated and the user is informed.

### 9.3 Static Analysis

Before execution, analyze the expression for:
- Nested exponentiation patterns (warn about potential overflow)
- Division where divisor could be zero
- Total operation count > 100 (warn about complexity)

---

## 10. Save / Share / Apply Logic

### 10.1 OK Button

**If "Save for Future Use" is checked:**

1. Validate that Name is not blank. If blank, show error: "Please enter a name for this expression."
2. Check name uniqueness:
   - If name is unique: proceed to step 3
   - If name matches an expression the user owns (editing): prompt "Update existing expression '[name]'? The previous version will be overwritten." with "Update" / "Save as New" / "Cancel"
   - If name matches an expression the user does NOT own (and user is Admin): same prompt as above
   - If name matches someone else's expression (and user is NOT Admin): show error "This name is already in use. Please choose a different name."
3. Prompt: "Test this expression, save it, and apply it?" with "Save & Apply" and "Cancel"
4. Run performance test (same as Test button)
5. **If test succeeds**: Save to database, apply to the context, close the modal
6. **If test fails with error**: "This expression produces an error. Please check your formula." with "Cancel" (return to editing) and "Save for Later" (save without applying)
7. **If test succeeds but is slow**: "This expression may impact performance due to complexity. [details]" with:
   - "Cancel" (return to editing)
   - "Save for Later" (save without applying)
   - "Accept & Apply" (only enabled if the expression runs client-side only, not server-side)

**If "Save for Future Use" is unchecked:**

1. Prompt: "Test this expression and apply it?" with "Apply" and "Cancel"
2. Run performance test
3. Same success/failure/slow logic as above, but without save options

### 10.2 Cancel Button

If there are any unsaved changes (tiles added/removed/moved, values changed, options changed):
- Prompt: "You have unsaved changes. Discard changes?" with "Discard" and "Keep Editing"

If no changes: close immediately.

### 10.3 Share Behavior

- Only users with Admin role (or `system:expression_manage` permission) see the "Share" checkbox
- Shared expressions are read-only for non-owners (non-admins cannot edit/delete)
- Admin users can edit or delete any shared expression
- Non-shared expressions are visible only to their creator

---

## 11. Serialization Format

Expressions are stored as an AST (Abstract Syntax Tree) in JSON format, compatible with PostgreSQL JSONB.

### 11.1 AST Schema

The same AST JSON format is used across all 6 expression contexts. Context is tagged in the AST metadata so the evaluation engine knows how to bind inputs (which variables resolve from OPC subscriptions, which from checkpoint field values, which from widget data queries, etc.).

```json
{
  "version": 1,
  "context": "point_config",
  "root": { ... },
  "output": {
    "type": "float",
    "precision": 3
  }
}
```

### 11.2 Node Types

```typescript
type ExprNode =
  | LiteralNode
  | PointRefNode
  | FieldRefNode
  | UnaryNode
  | BinaryNode
  | FunctionNode
  | ConditionalNode
  | GroupNode;

// A fixed numeric value (from Enter Value tile)
type LiteralNode = {
  type: "literal";
  value: number;
};

// A reference to a point value
type PointRefNode = {
  type: "point_ref";
  ref_type: "current" | "specific";
  point_id: string | null;     // UUID if specific, null if current
  tagname: string | null;      // Display name if specific, null if current
};

// A reference to a context field value (rounds checkpoint fields, log segment fields)
type FieldRefNode = {
  type: "field_ref";
  field_name: string;            // Field name within the context object (e.g., "feet", "inches", "eighths")
};

// Unary operations (single operand inside parentheses)
type UnaryNode = {
  type: "unary";
  op: "negate" | "abs" | "square" | "cube";
  operand: ExprNode;
};

// Binary operations (left operator right)
type BinaryNode = {
  type: "binary";
  op: "+" | "-" | "*" | "/" | "%" | "^" | ">" | "<" | ">=" | "<=";
  left: ExprNode;
  right: ExprNode;
};

// Function calls with arguments
type FunctionNode = {
  type: "function";
  name: "round";
  args: ExprNode[];
  params: Record<string, number>;  // e.g., { "precision": 0.1 } for Round tile
};

// If-Then-Else
type ConditionalNode = {
  type: "conditional";
  condition: ExprNode;
  then: ExprNode;
  else_branch: ExprNode | null;  // null means return 0
};

// Explicit parentheses group
type GroupNode = {
  type: "group";
  child: ExprNode;
};
```

### 11.3 Corresponding Rust Types

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpressionDocument {
    pub version: u32,
    pub context: String,  // "point_config" | "alarm_definition" | "rounds_checkpoint" | "log_segment" | "widget" | "forensics"
    pub root: ExprNode,
    pub output: OutputConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputConfig {
    #[serde(rename = "type")]
    pub output_type: String,  // "float" | "integer"
    pub precision: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ExprNode {
    #[serde(rename = "literal")]
    Literal { value: f64 },

    #[serde(rename = "point_ref")]
    PointRef {
        ref_type: String,
        point_id: Option<String>,
        tagname: Option<String>,
    },

    #[serde(rename = "field_ref")]
    FieldRef {
        field_name: String,
    },

    #[serde(rename = "unary")]
    Unary { op: String, operand: Box<ExprNode> },

    #[serde(rename = "binary")]
    Binary { op: String, left: Box<ExprNode>, right: Box<ExprNode> },

    #[serde(rename = "function")]
    Function {
        name: String,
        args: Vec<ExprNode>,
        params: std::collections::HashMap<String, f64>,
    },

    #[serde(rename = "conditional")]
    Conditional {
        condition: Box<ExprNode>,
        then: Box<ExprNode>,
        else_branch: Option<Box<ExprNode>>,
    },

    #[serde(rename = "group")]
    Group { child: Box<ExprNode> },
}
```

### 11.4 Example

The expression `((Current Point Value + 5) * 47) / 100`:

```json
{
  "version": 1,
  "root": {
    "type": "binary",
    "op": "/",
    "left": {
      "type": "group",
      "child": {
        "type": "binary",
        "op": "*",
        "left": {
          "type": "group",
          "child": {
            "type": "binary",
            "op": "+",
            "left": { "type": "point_ref", "ref_type": "current", "point_id": null, "tagname": null },
            "right": { "type": "literal", "value": 5 }
          }
        },
        "right": { "type": "literal", "value": 47 }
      }
    },
    "right": { "type": "literal", "value": 100 }
  },
  "output": { "type": "float", "precision": 3 }
}
```

---

## 12. Database Schema

```sql
-- Saved expressions (custom conversions, calculated values, etc.)
CREATE TABLE custom_expressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Expression definition (AST JSON, see Section 11)
    expression JSONB NOT NULL,

    -- Output configuration
    output_type VARCHAR(20) NOT NULL DEFAULT 'float'
        CHECK (output_type IN ('float', 'integer')),
    output_precision INTEGER DEFAULT 3
        CHECK (output_precision IS NULL OR (output_precision >= 0 AND output_precision <= 7)),

    -- Context: what kind of expression this is
    expression_context VARCHAR(50) NOT NULL DEFAULT 'point_config'
        CHECK (expression_context IN ('point_config', 'alarm_definition', 'rounds_checkpoint', 'log_segment', 'widget', 'forensics')),

    -- Ownership and sharing
    created_by UUID NOT NULL REFERENCES users(id),
    shared BOOLEAN NOT NULL DEFAULT false,

    -- Denormalized point references (for querying "which expressions use point X?")
    referenced_point_ids UUID[] DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX uq_custom_expressions_name
    ON custom_expressions(name);
CREATE INDEX idx_custom_expressions_created_by
    ON custom_expressions(created_by);
CREATE INDEX idx_custom_expressions_context
    ON custom_expressions(expression_context);
CREATE INDEX idx_custom_expressions_shared
    ON custom_expressions(shared) WHERE shared = true;
CREATE INDEX idx_custom_expressions_point_refs
    ON custom_expressions USING GIN (referenced_point_ids);

-- Triggers
CREATE TRIGGER trg_custom_expressions_updated_at
    BEFORE UPDATE ON custom_expressions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_custom_expressions
    AFTER INSERT OR UPDATE OR DELETE ON custom_expressions
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();
```

### Linking Expressions to Points

When a custom conversion is applied to a point, it is stored on `points_metadata`:

```sql
-- Add to points_metadata (via ALTER TABLE in migration)
ALTER TABLE points_metadata
    ADD COLUMN custom_expression_id UUID REFERENCES custom_expressions(id) ON DELETE SET NULL;

CREATE INDEX idx_points_metadata_custom_expression_id
    ON points_metadata(custom_expression_id) WHERE custom_expression_id IS NOT NULL;
```

When a point has a `custom_expression_id`, the frontend applies the expression to the point's raw value before display. The API Gateway applies it server-side for historical data queries.

---

## 13. Evaluation Architecture

The Rhai-based server-side evaluation engine and expr-eval-fork client-side engine both run identically regardless of context. The only difference is **input binding** — what variables are resolved from where:

| Context | Client-Side Input Binding | Server-Side Input Binding |
|---------|--------------------------|--------------------------|
| `point_config` | OPC point values from WebSocket | Point values from TimescaleDB query |
| `alarm_definition` | OPC point values from WebSocket | Point values from latest `points_current` |
| `rounds_checkpoint` | Checkpoint field values from form state + OPC values from WebSocket | Checkpoint field values from `round_responses` + point values from DB |
| `log_segment` | Segment field values from form state + OPC values from WebSocket | Segment field values from `log_entries` + point values from DB |
| `widget` | OPC point values from WebSocket + aggregation query results | Aggregation query results from TimescaleDB |
| `forensics` | N/A (server-side only for historical analysis) | Point values from TimescaleDB over time range |

### 13.1 Client-Side (Real-Time Display)

**Library**: `expr-eval-fork` v3.0.1 (MIT)

The AST JSON is converted to an infix expression string and compiled once. The compiled expression is called on every point value update.

```typescript
import { Parser } from 'expr-eval-fork';

// Compile once when expression is loaded
function compileExpression(ast: ExprNode): (vars: Record<string, number>) => number {
  const parser = new Parser();
  const exprString = astToInfixString(ast);
  const compiled = parser.parse(exprString);
  return (vars) => compiled.evaluate(vars);
}

// Called on every point update (~0.01ms per call)
const evaluate = compileExpression(savedExpression.root);
const displayValue = evaluate({ current_point_value: rawValue, "TI-101.PV": otherPointValue });
```

**Security**: expr-eval-fork v3.0.1 uses pure AST tree-walking (no `eval()` or `Function()`). The v3.0.1 release patched CVE-2025-12735 (critical RCE). The secure function allowlist prevents access to JavaScript internals.

**Point value resolution**: Before evaluation, the frontend resolves all `point_ref` nodes:
- `"current"` refs are bound to the current point's latest value from the WebSocket
- `"specific"` refs are bound to the named point's latest value from the WebSocket subscription

### 13.2 Server-Side (Historical Data, Reports)

**Library**: `Rhai` v1.19.0 (MIT OR Apache-2.0)

The AST JSON is converted to a Rhai expression string and evaluated in expression-only mode.

```rust
use rhai::Engine;

let engine = Engine::new();
// expression-only mode: no loops, no assignments, no function definitions
let result: f64 = engine.eval_expression_with_scope::<f64>(&mut scope, &expression_string)?;
```

**Why Rhai over fasteval**: Rhai is the only MIT/Apache-2.0 Rust expression library with native `if/else` conditional support in expression-only mode. fasteval lacks conditionals entirely.

**Safety**: Rhai's `eval_expression()` mode restricts to expressions only. Built-in limits for execution time, recursion depth, and operation count prevent runaway expressions.

### 13.3 Evaluation Flow

```
REAL-TIME (client-side):
  Point update arrives via WebSocket
  → Frontend checks if point has custom_expression_id
  → If yes: evaluate compiled expression with current values
  → Apply output formatting (float precision or integer truncation)
  → Display converted value

HISTORICAL (server-side):
  API request for historical data of point with custom expression
  → API Gateway loads expression from database
  → API Gateway evaluates expression in Rhai for each data point
  → Apply output formatting
  → Return converted values in response
```

---

## 14. Library Dependencies

| Library | Purpose | License | Side |
|---------|---------|---------|------|
| @dnd-kit/core v6.x | Drag-and-drop framework | MIT | Client |
| @dnd-kit/sortable v7.x | Sortable presets for workspace | MIT | Client |
| @dnd-kit/modifiers | Snap-to-grid and drag modifiers | MIT | Client |
| expr-eval-fork v3.0.1 | Safe expression evaluation | MIT | Client |
| Rhai v1.19.0 | Expression evaluation (expression-only mode) | MIT OR Apache-2.0 | Server |

All libraries comply with the licensing requirement: MIT, Apache 2.0, BSD, ISC, PostgreSQL License, or MPL 2.0 only. No GPL/AGPL/copyleft.

---

## 15. Accessibility

### 15.1 Keyboard Navigation

The workspace is a single tab stop. Once focused, navigation is via arrow keys:

| Key | Action |
|-----|--------|
| Tab | Move focus into/out of workspace |
| Left/Right Arrow | Move cursor between tiles |
| Up Arrow | Exit current container (to parent level) |
| Down Arrow | Enter container tile (to first child) |
| Home/End | Move cursor to start/end of expression |
| Enter | On palette tile: insert at cursor. On workspace tile: begin keyboard drag |
| Space | Toggle tile selection |
| Delete | Delete selected tiles (with confirmation) |
| Escape | Cancel drag, deselect all, or exit workspace focus |
| Ctrl+A | Select all tiles |
| Ctrl+C | Copy selected |
| Ctrl+X | Cut selected |
| Ctrl+V | Paste at cursor |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |

### 15.2 Screen Reader Support

- Workspace: `role="application"` with `aria-label="Equation workspace"`
- Tiles: `role="option"` with descriptive `aria-label` (e.g., "Plus operator", "Point Reference: TI-101.PV")
- Container tiles: `role="group"` with `aria-label` including nesting level
- Live expression readout: `aria-live="polite"` region updates with the text expression as tiles change
- Announcements for all tile operations (add, remove, move, error)

### 15.3 Touch Targets

All interactive elements meet the 60px minimum for gloved industrial operation:
- Palette tiles: 60x60px minimum
- Workspace tiles: 60x60px minimum
- Buttons: 60px minimum height
- Dropdown options: 60px minimum height
- Between-tile cursor areas: 20px effective touch width (invisible hit expansion)

### 15.4 Theme Support

The Expression Builder inherits the application's active theme (light, dark, high-contrast). All colors are defined as CSS custom properties:
- Tile backgrounds, borders, and text colors adapt to theme
- Nesting depth colors have theme-specific variants (see Section 6.5)
- High-contrast mode uses border style variations (solid/dashed/dotted/double) in addition to color

---

## 16. API Endpoints

```
GET    /api/expressions                    - List saved expressions (filtered by context, owned + shared)
GET    /api/expressions/:id                - Get expression details
POST   /api/expressions                    - Create new expression
PUT    /api/expressions/:id                - Update expression (owner or admin only)
DELETE /api/expressions/:id                - Delete expression (owner or admin only)
GET    /api/expressions/by-context/:ctx    - List expressions for a specific context
GET    /api/expressions/by-point/:pointId  - List expressions referencing a specific point
POST   /api/expressions/test               - Test-evaluate an expression with a given value
PUT    /api/points/:id/custom-expression  - Apply or clear a saved expression on a point
```

**Permissions**:
- All authenticated users can create and read their own expressions
- All authenticated users can read shared expressions
- Only the owner or Admin can update/delete an expression
- Only Admin can set `shared = true`

---

## 17. Integration Points

### Point Configuration — Settings Module (15)

- Point configuration UI has a "Custom Conversion" button next to each point
- Opens Expression Builder with `context="point_config"` and `contextPointId` set to the selected point
- On apply: sets `points_metadata.custom_expression_id` for the point
- Points with `custom_expression_id` automatically have their display values converted client-side in Console (07) and Process (08) modules

### Alarm Definitions — Alert System (27)

- Alarm definition UI offers two paths: threshold wizard (simple) and expression builder (complex)
- Expression builder path opens with `context="alarm_definition"`
- On apply: stores expression in alarm definition — evaluated by Alert Service on each point update
- Supports multi-point voting logic, cross-source correlation, conditional alarms

### Rounds Checkpoints — Rounds Module (14)

- Checkpoint definition UI in template configuration includes expression builder for multi-field and deviation calculations
- Opens Expression Builder with `context="rounds_checkpoint"` and `contextObjectId` set to the checkpoint definition
- On apply: stores expression in checkpoint template — evaluated when operator submits round entry
- Raw field values always stored; calculated value stored alongside

### Log Segments — Log Module (13)

- Segment field definition in template configuration includes expression builder for calculated fields
- Opens Expression Builder with `context="log_segment"` and `contextObjectId` set to the segment definition
- On apply: stores expression in segment template — evaluated when log entry is saved

### Dashboard/Report Widgets — Designer (09), Dashboards (10), Reports (11)

- Widget configuration in Designer gains a "Custom Expression" option for data source
- Opens Expression Builder with `context="widget"`
- On apply: stores expression reference in widget configuration — evaluated on each widget data refresh

### Forensics — Forensics Module (12)

- Analysis workspace has an "Add Calculated Series" option
- Opens Expression Builder with `context="forensics"`
- On apply: adds computed series to the correlation analysis — evaluated per data point across selected time range

---

## 18. Future Extensibility

### Additional Tile Types (Future)

| Tile | Purpose | When Needed |
|------|---------|-------------|
| String comparison | Text matching | Advanced filtering |
| Min/Max of multiple values | Multi-point aggregation | Calculated points |
| Rate of change | Derivative estimation | Alarm/trend detection |
| Moving average | Smoothing | Signal processing |
| Deadband | Suppress noise within tolerance | Alarm conditions |

### Calculated/Derived Points (Future)

- A "calculated point" is a virtual point whose value is computed from an expression referencing one or more real points
- Computed by the Data Broker or a dedicated Calculation Service
- Stored in `points_current` like real points, subscribable via WebSocket
- Requires a new `point_sources` entry with `source_type = 'calculated'`

### Multi-Output Expressions (Future)

- Expressions that produce multiple named outputs (e.g., a complex calculation that yields both a converted value and a quality indicator)
- Requires extending the AST format with named output nodes

### Additional Contexts (Future)

- New contexts can be added by defining an input catalog and registering it with the expression builder component
- No changes to the evaluation engine, AST format, or UI mechanics are required

---

## Change Log

- **v0.4**: Added context-dependent input catalogs for 6 usage contexts (point config, alarm definitions, rounds checkpoints, log segments, dashboard/report widgets, forensics). Expression builder is a uniform shared component — same engine, same UI, same AST — with context-filtered inputs. Added `FieldRefNode` AST type for checkpoint/segment field references. Added context field to AST metadata. Updated `expression_context` enum in database schema. Rewrote integration points to reflect all 6 contexts. Renumbered sections (new Section 3 inserted). References doc 32 (Shared UI Components) for modal specification.
- **v0.3**: Fixed 2 incorrect permission references for expression sharing: `system:point_config` changed to `system:expression_manage` (Save/Share checkbox in Section 3 and Share Behavior in Section 9.3). Aligns with RBAC model in doc 03.
- **v0.2**: Consistency fixes: corrected CVE patch version from v3.0.0 to v3.0.1 for expr-eval-fork. Standardized Rhai license format to SPDX identifier "MIT OR Apache-2.0". Added missing `PUT /api/points/:id/custom-expression` endpoint to Section 15 API summary.
- **v0.1**: Initial design. Drag-and-drop tile-based expression builder with 18 tile types, multi-point support, AST JSON serialization, real-time validation, performance benchmarking, save/share functionality, client-side evaluation (expr-eval-fork), server-side evaluation (Rhai), accessibility with keyboard navigation and screen reader support, 3-theme color system with Okabe-Ito nesting depth palette, integration points across 7 modules, future extensibility for alarm conditions and calculated points.
