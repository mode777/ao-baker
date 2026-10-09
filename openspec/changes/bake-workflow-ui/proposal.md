# Proposal

## Why

The engine exists (`ao-bake-engine`) but nothing in the app calls it. This
change turns the viewer into a usable baking tool: parameters, bake with
progress, baked preview, and iteration (re-bake, cancel) - everything except
export.

## What Changes

- Parameters sidebar: samples per vertex, occlusion radius, strength, bias
  (auto default), with visible current values.
- Bake button running the engine in its Web Worker; progress bar driven by
  worker progress messages; UI stays responsive (orbit while baking).
- Baked COLOR_0 written into the preview scene's geometries as a live vertex
  color attribute.
- View modes: original (no vertex colors), baked (materials use vertex
  colors), AO-only (unlit white base multiplied by vertex colors - the
  judge-the-bake view).
- Re-bake on changed parameters; cancel terminates the in-flight bake and
  returns to the previous state.

## Capabilities

### New Capabilities

- `bake-workflow`: the end-to-end in-app baking experience - parameter
  control, bake execution with progress and cancellation, and preview of the
  baked result on the model.

### Modified Capabilities

(none - `model-viewer` behavior is unchanged; view modes are additive UI on
top of its viewport)

## Impact

- `src/ui/` gains the sidebar and progress components; `src/viewer/` gains
  view-mode application (material vertexColors toggling / override material);
  `src/baker/` worker is instantiated from the app (new `baker/client.ts`
  main-thread wrapper or equivalent).
- Loading a new model resets bake state.
- No export, no gltf-transform usage yet (`glb-export-pipeline`).
