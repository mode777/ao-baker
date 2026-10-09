# Architecture

This is the global architecture for ao-baker. It is the authoritative reference
for design decisions; OpenSpec changes should not contradict it. Captured
during the initial exploration; updated as the system evolves.

## 1. Purpose and product contract

ao-baker is a browser-based tool, hosted on GitHub Pages, that:

1. loads GLB files via drag-and-drop (all processing client-side, no backend),
2. bakes ambient occlusion into vertex colors with user-tweakable parameters,
3. previews the result on an orbitable 3D model, and
4. re-exports a GLB containing the baked vertex-color (`COLOR_0`) attribute.

**Core contract: everything except `COLOR_0` must survive the round trip
untouched.** Materials, animations, skins, extensions, meshopt compression, and
custom extras are not ours to alter. This contract drives the export design
(D1 below).

## 2. High-level data flow

```
                GLB file (drag & drop)
                        |
                        v
        +---------------------------+
        |        LOAD / IO          |
        |  same ArrayBuffer ->     |
        |   a) three.js scene      |   (preview)
        |   b) gltf-transform      |   (export document,
        |      Document            |    edited surgically)
        +---------------------------+
            |                    |
            v                    v
   +----------------+    +----------------------+
   |    PREVIEW     |    |     BAKE ENGINE      |
   | three.js scene |    | (Web Worker)         |
   | orbit controls |    | vertex welding map   |
   | view modes:    |<---| combined-scene BVH   |
   |  original /    |    | hemisphere sampling  |
   |  baked /       |    | bake mode (AO today, |
   |  AO-only       |    |  HDRI lighting later)|
   +----------------+    +----------------------+
            ^                    |
            | COLOR_0 (live      | COLOR_0 (same vertex
            |  preview attr)     |  indices, into Document)
            |                    v
            |         +---------------------------+
            |         |         EXPORT            |
            |         | inject COLOR_0 into the   |
            |         | original document -> GLB  |
            |         | -> browser download       |
            +---------+---------------------------+
```

## 3. Technology stack

| Concern | Choice | Notes |
|---|---|---|
| Rendering | three.js (`three` + `three/addons/*`) | OrbitControls, GLTFLoader, RoomEnvironment, vertex-color materials |
| Ray acceleration | three-mesh-bvh | accelerated raycasts against arbitrary meshes; runs headless in a Worker |
| GLB read/write | `@gltf-transform/core` + extensions | surgical COLOR_0 injection; preserves the rest of the document |
| Bake thread | Web Worker | BVH build + millions of raycasts off the main thread; transferable buffers |
| Language | TypeScript (strict) | |
| Build | Vite | `base: '/ao-baker/'` for GitHub Pages project-site path |
| UI | vanilla TS + CSS | no framework; the UI is one sidebar + one canvas |
| Tests | Vitest | baker is pure, testable functions |
| Deploy | GitHub Actions -> GitHub Pages | build `dist/`, upload artifact, `actions/deploy-pages` |

## 4. Core decisions

| ID | Decision | Rationale |
|---|---|---|
| D1 | Export via gltf-transform surgical edit, NOT three.js GLTFExporter round-trip | The exporter re-serializes and can drop extensions/extras. gltf-transform edits the original document in place, keeping the product contract. GLTFExporter is never used. |
| D2 | Vanilla TypeScript UI, no UI framework | One sidebar + one canvas; baking is imperative geometry work that fights declarative frameworks; halves the bundle. |
| D3 | Cross-mesh occlusion is always on (one combined-scene BVH) | An arm should shadow a torso. Cost is negligible once the BVH exists. A toggle can be added later if ever requested. |
| D4 | If input already has COLOR_0: overwrite by default | Predictable. A combine (multiply) option is planned in the polish phase. |

### Dual-parse loading (consequence of D1)

The same file bytes are parsed twice: GLTFLoader builds the preview scene;
gltf-transform holds the export Document. This is safe because both preserve
primitive vertex order and count, so **vertex N of a three.js mesh always
corresponds to vertex N of the same glTF primitive**. This invariant is not
assumed — it is guarded by round-trip regression tests (see `glb-export-pipeline`).

## 5. Module map (target layout)

```
src/
  main.ts              app entry
  viewer/              three.js scene: orbit, environment, view modes
  loader/              File -> ArrayBuffer -> preview scene + gltf Document
  baker/
    kernel.ts          welding, combined BVH, hemisphere sampling (pure)
    modes/ao.ts        AO accumulation strategy
    worker.ts          worker host
    protocol.ts        message types shared with main thread
  export/              COLOR_0 injection into Document, download
  ui/                  vanilla TS controls (sidebar, dropzone, progress)
```

The baker kernel has no DOM or WebGL dependencies (three.js core math/geometry
only) so it can run in a Web Worker and be unit-tested headless.

## 6. Bake engine: kernel / mode split (HDRI extension point)

The engine is designed so that **baking HDRI-based lighting into vertex colors
can be added later as a new bake mode without touching geometry-side
machinery**. (Not on the current roadmap - see docs/roadmap.md - but the
architecture must not preclude it.)

```
                     +--------------------------+
                     |       BakeKernel         |
                     |  (shared, geometry-side) |
                     |  - weld map (positions)  |
                     |  - combined world BVH    |
                     |  - cos-weighted          |
                     |    hemisphere sampler    |
                     |  - seeded RNG            |
                     |  - per-ray visibility:   |
                     |    direction + hit dist  |
                     +------------+-------------+
                                  |
                    visibility rays per vertex
                                  |
              +-------------------+-------------------+
              |                                       |
        +-----v------+                        +------v--------+
        | AO mode    |                        | (future) HDRI |
        | (today)    |                        | lighting mode |
        | occlusion  |                        | env radiance  |
        | fraction   |                        | along visible |
        | -> scalar  |                        | directions    |
        +-----+------+                        +------+--------+
              |                                      |
              +------------------+-------------------+
                                 |
                  Float32Array RGB per vertex (always RGB,
                  scalar AO is broadcast R=G=B for forward compat)
```

What stays shared when HDRI arrives: welding, combined BVH, hemisphere
sampling, bias, seeded RNG, worker protocol, COLOR_0 writeback into both the
preview scene and the export Document, and the export/download path.

What a future HDRI mode adds: equirect environment loading (e.g. DataTexture
readable on the worker), radiance lookup per unoccluded direction, RGB
accumulation, exposure/output-mapping parameters, and a mode selector in the
UI. The worker protocol carries a `mode` field from day one so this is a
protocol-compatible extension.

## 7. Invariants and hard-won gotchas

1. **Vertex welding.** glTF meshes duplicate vertices along UV seams and
   normal splits. Bake AO per unique *position* (spatial hash), then fan the
   value out to all duplicates - otherwise AO seams appear on every UV cut.
2. **Ray origin bias.** Rays start an epsilon along the vertex normal or
   self-intersection speckles the result.
3. **World-space, rest-pose baking.** Positions may be quantized
   (`KHR_mesh_quantization`) and transformed by node matrices; skinned meshes
   bake against the bind pose; morph targets are ignored.
4. **Relative radius.** The occlusion radius parameter is expressed as a
   fraction of the scene bounding-box diagonal - user models range from
   centimeters to hundreds of meters.
5. **Seeded RNG.** Sampling uses a seeded PRNG so bakes are reproducible and
   testable.
6. **RGB accumulation from day one.** The result buffer is always
   Float32 RGB per vertex (scalar AO broadcast to R=G=B) so HDRI lighting
   later needs no plumbing changes.
7. **Pages base path.** The site serves from `/ao-baker/`; Vite `base` (and
   any absolute asset URL) must match or assets 404.

## 8. Constraints

- Static hosting only (GitHub Pages): no backend, no server processing, all
  parsing/baking/export in the browser.
- Client-side bundle budget: three.js + three-mesh-bvh + gltf-transform is
  acceptable; avoid pulling a UI framework or HDR files - use procedural
  studio lighting (RoomEnvironment).
- Repo/site limits: GitHub Pages soft limits (~1 GB site, 100 MB files) are
  far above our bundle; test fixtures must stay tiny.

## 9. Known limitations (v1)

- Skinned meshes bake in rest/bind pose; morph targets ignored.
- `EXT_mesh_gpu_instancing` instances are baked as a single placement (v1).
- Draco/meshopt-compressed inputs are supported; output COLOR_0 is VEC3 FLOAT
  (per-vertex size cost accepted for simplicity; quantization is a possible
  later option).
- AO radius uses scene-diagonal relativity; extremely heterogeneous scenes
  (tiny object next to huge one) may need manual radius tuning.
