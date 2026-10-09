# Proposal

## Why

The pipeline works end to end but assumes ideal inputs and manual parameter
tuning. This change adds trust and ergonomics: presets for common quality
levels, a combine option for pre-colored models, explicit handling of bad or
oversized inputs, and user-facing documentation.

## What Changes

- Bake presets: "Preview / fast", "Balanced" (default), "High quality" -
  parameter sets applied in one click, still tweakable afterwards.
- Combine policy option for inputs with existing COLOR_0: overwrite
  (default, D4) or multiply baked AO into existing colors.
- Robust loading: clear, distinct errors for corrupt files, non-GLB files,
  and empty/no-mesh scenes; a warning (non-blocking) for very large scenes
  (vertex-count threshold) with expected bake-time hint.
- README with screenshots, usage guide, parameter explanations, and
  limitations (rest-pose baking, instancing).

## Capabilities

### New Capabilities

- `presets`: one-click parameter sets mapping to named quality levels.

### Modified Capabilities

- `model-viewer`: robust loading behavior (error/warning handling for bad
  and oversized inputs) added as new requirements.
- `glb-export`: COLOR_0 combine policy becomes configurable (overwrite
  default, multiply option) - added as a new requirement; no existing
  requirement text changes.

## Impact

- `src/ui/` (preset selector, combine toggle, warning banner), `src/baker/`
  (multiply-combine application on writeback paths), `src/export/` (policy
  honored at injection), README + docs/screens.
- No new dependencies.
