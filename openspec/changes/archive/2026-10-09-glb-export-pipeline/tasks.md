# Tasks

## 1. Document pipeline

- [x] 1.1 Integrate gltf-transform into the loader service: dual-parse `loadModel` returning `{ scene, document }` from the same bytes, shared traversal order for meshes/primitives; verify with unit test: traversal lists identical primitive/mesh ordering for both parses on a fixture
- [x] 1.2 Implement COLOR_0 injection in `src/export/` (VEC3 FLOAT accessor per primitive, overwrite existing, D4) and GLB serialization to Blob; verify with unit test: injected values round-trip through re-read within float32 tolerance

## 2. Fidelity and compressed inputs

- [x] 2.1 Build fixture generator (rich fixture: animation + skin + extras + KHR extension; Draco fixture); verify: fixtures load in both gltf-transform and GLTFLoader
- [x] 2.2 Add preservation test (everything-but-COLOR_0 unchanged) and round-trip correspondence test (preview result == exported COLOR_0); verify `npm test` catches a deliberately broken injection (mutation check)
- [x] 2.3 Wire Draco decoder assets (static copy, base-path-aware decoder path) into preview loading and gltf-transform extensions; verify: Draco fixture loads, previews, bakes, exports in dev

## 3. Export UI

- [x] 3.1 Add export button (enabled on completed bake, disabled otherwise) and download flow with `<name>-baked.glb` naming; verify in dev end to end: drop rich fixture -> bake -> export -> re-drop exported file -> colors match preview
- [x] 3.2 `npm run lint && npm run typecheck && npm test` green; confirm GLTFExporter is nowhere imported (grep)

## Workflow follow-up

- Archive this change before starting `product-polish`.
