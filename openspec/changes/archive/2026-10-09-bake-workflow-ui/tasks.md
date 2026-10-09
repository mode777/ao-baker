# Tasks

## 1. Bake client and state

- [x] 1.1 Implement main-thread worker client (lazy spawn, request/response correlation, progress subscription, cancel via terminate+respawn); verify with a unit test against a stub worker or the engine directly: bake -> progress -> result, then cancel path returns to idle
- [x] 1.2 Implement bake state store (idle/baking/baked, parameter staging, model-reset hook); verify with unit tests: double-bake guard, cancel keeps previous baked state, new model resets defaults

## 2. Viewer integration

- [x] 2.1 Implement result application: write per-mesh COLOR_0 attribute from bake result slices (shared vertex-order assembly used for both request and result); verify: bake a test GLB in dev, inspect `geometry.attributes.color` lengths match position counts
- [x] 2.2 Implement view modes (original / baked / AO-only with material cache and restore); verify in dev: switching all three modes after a bake, and before any bake, shows expected appearances

## 3. Sidebar UI

- [x] 3.1 Build sidebar (parameters with ranges + numeric readouts, bake/cancel button, progress bar with indeterminate BVH phase, view-mode segmented control); verify in dev: values stage correctly, ranges enforced, button states follow lifecycle
- [x] 3.2 Wire dropzone -> model reset (clear colors + defaults); verify: load model, bake, load second model - no stale colors or parameters
- [x] 3.3 Full manual pass in dev: orbit during bake, cancel mid-bake, re-bake with changed samples/radius/strength/bias; then `npm run lint && npm run typecheck && npm test` green

## Workflow follow-up

- Archive this change before starting `glb-export-pipeline`.
