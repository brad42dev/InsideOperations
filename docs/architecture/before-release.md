# Before Release — Pre-Demo Requirements

Items that must be completed before the app is ready to demo. Not necessarily in order — some are blocked on others.

---

## Shape Authoring Wizard (Stencil → Shape)

**What:** A visual tool for converting a raw SVG ("stencil") into a fully specified shape with a complete sidecar.

The workflow:
1. Import an SVG from file, or select elements drawn on the designer canvas and choose "Create Shape from Selection"
2. Wizard overlays the SVG and lets the author:
   - Click points on the shape to place and name anchor slots (connection points), with direction and type
   - Define text zones, value anchors, alarm anchor positions
   - Configure which addons the shape accepts (agitator, jacket, support legs, etc.)
   - Trace the vessel interior path for fill gauges
   - Set state CSS classes (running / stopped / alarm / etc.)
   - Mark bindable parts (sub-elements that take individual point bindings)
3. Wizard writes the complete sidecar to the DB via API

This is also the correct long-term update path for library shapes — instead of editing disk JSON files, a developer re-opens the shape in the wizard and makes changes there.

**Blocked on:** sidecar validation-on-write being implemented first (so wizard output is guaranteed valid).

---

## anchorSlots — Populate All Library Shapes

All 85 current library shapes have no `anchorSlots` data in their sidecars. The snap-to-slot connection system cannot function until this is populated.

The stencil wizard is the correct tool for doing this — open each shape, visually place the anchor slots, save.

**Blocked on:** Stencil wizard above.

---

## iographic Full Export Mode

**What:** A self-contained, portable iographic export that works on any IO system regardless of version.

Two modes:
- **Thin** (default): records `shape_id` + content hashes (`sidecar_hash`, `svg_hash`) for each shape. Import resolves shapes from the target DB. Used for quick backup of graphics on the same system.
- **Full**: embeds complete SVG + sidecar JSON + hashes for every shape the graphic references. On import: hash-match each shape; any mismatch → import the embedded version, updating the target DB. Makes a graphic 100% portable — works on any IO version, with custom shapes, across customer sites.

Content hashes must be deterministic so the same shape produces the same hash on any IO system:
- **Sidecar hash:** SHA-256 of RFC 8785 (JSON Canonicalization Scheme) serialization — keys sorted recursively, no whitespace, Unicode normalized. In Rust: serialize through `BTreeMap`.
- **SVG hash:** SHA-256 of raw SVG bytes with line endings normalized to `\n`.

Import ownership policy (confirmed):
- **Library shapes** (`source='library'`): **never overwritten by any user action.** If a full import contains a library shape whose hash doesn't match the target DB version (older version, etc.), the embedded shape is imported as a new **user shape** with a disambiguating suffix — e.g., `valve-control.imported`, or `valve-control.imported.{short-hash}` if a collision exists. The graphic's shape references are updated to the new imported name so the graphic renders exactly as authored. The original library shape is untouched.
- **User shapes** (`source='user'`): file version imported/updated.
- **Shapes not present in target at all:** imported from file as `source='user'`.
- Library shapes are **development-only changes** — no user-facing operation can mutate them.

**Blocked on:** `sidecar_hash` and `svg_hash` fields being added to shape records.

---

## compositeAttachments Coordinate Fixes

All reactor shapes have both agitator and support `compositeAttachments` at `{x:0, y:0}` — confirmed placeholder values. Agitators attach at the top of the vessel; supports attach at the bottom. Real coordinates need to be calculated and populated for each reactor shape.

Also required: `geometry.bodyBase` must be populated on every attachable part shape (agitator types, support types, actuator types, fail indicator parts). The renderer computes placement as `px = attachment.x - bodyBase.x`, `py = attachment.y - bodyBase.y`. Without `bodyBase` on the part, attachment coordinate fixes on the base shape will produce wrong rendering. These two fixes must be done together.

Affects: all shapes in `frontend/shapes-source/reactors/` and any vessel shapes with agitator/support addons; all part shapes in `actuators/` and similar.

**Blocked on:** knowing correct coordinates. Can be done via `dev.sh shapes import` or via the stencil wizard once it exists.

---

## defaultSlots → anchorSlots Validation in Stencil Wizard

When the stencil wizard populates `anchorSlots` for a shape, it must validate that all existing `defaultSlots` values in that sidecar match actual slot names in the newly created `anchorSlots` data. `defaultSlots` entries are forward references to slot names — if the names don't match, the runtime rendering will silently use wrong positions.

**Blocked on:** Stencil wizard above.

---

## forPart Matching Semantics — Document in Sidecar Spec

The `compositeAttachments[].forPart` field can match either a specific addon `id` (e.g., `"fail-open"`) or an addon `group` name (e.g., `"agitator"`) — ID is checked first, group is the fallback. This logic exists only in `renderNodeSvg.tsx` and is not documented in the schema or sidecar spec. Some shapes use IDs, some use group names, and the ambiguity could cause subtle bugs if the same string is used as both an ID and a group on different shapes. Document the matching order in the sidecar spec.
