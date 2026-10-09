# Proposal

## Why

Ambient-occlusion baking is the product's core value and its riskiest
component (welding, hemisphere visibility sampling, BVH raycasting at scale).
It must be built and tested as a pure, headless engine before any UI wiring,
so math bugs are caught by unit tests instead of through the viewport.

## What Changes

- New `src/baker/` module: a pure TypeScript bake engine with no DOM or
  WebGL dependencies (three.js core geometry/math only).
- Vertex welding map: AO is computed per unique position and fanned out to
  duplicated vertices (UV seams, normal splits) so AO has no seams.
- Combined world-space BVH over all meshes (rest pose) for cross-mesh
  occlusion (D3), built with three-mesh-bvh.
- Cosine-weighted hemisphere sampling with seeded RNG; configurable samples,
  radius (relative to scene bbox diagonal), strength, and ray bias.
- AO accumulation as a bake mode over the shared kernel (docs/architecture.md
  #6); results are Float32 RGB per vertex (scalar broadcast) for future HDRI
  compatibility.
- Web Worker host + message protocol (`mode` field from day one, transferable
  buffers, monotonic progress reporting).
- Vitest setup (first tests in the repo) + unit tests on synthetic geometry;
  CI test job added to the deploy workflow.

## Capabilities

### New Capabilities

- `ao-baking`: computes per-vertex ambient occlusion for a set of meshes -
  welding, sampling, occlusion semantics, determinism, and worker execution.

### Modified Capabilities

(none)

## Impact

- New dev/test dependencies: `vitest`, `three-mesh-bvh` (runtime).
- `src/baker/{kernel,modes/ao,worker,protocol}.ts` per the module map; no UI
  changes, no export changes.
- `.github/workflows/deploy.yml` gains a test step.
- The app does not call the engine yet (that is `bake-workflow-ui`); this
  change ships library code + worker, fully covered by tests.
