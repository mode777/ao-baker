# Design

## Context

Implements the product contract (docs/architecture.md #1) and decision D1:
export = surgical edit of the original document, never a re-serialization of
the three.js scene. Depends on `bake-workflow-ui` (bake results exist) and
extends the loader service boundary from `scaffold-web-app`.

## Goals / Non-Goals

**Goals:**

- Byte-faithful-everywhere-but-COLOR_0 export, proven by tests.
- One load path feeding preview, bake, and export from the same bytes.
- Compressed inputs (Draco) as first-class citizens.

**Non-Goals:**

- COLOR_0 quantization (VEC3 FLOAT stays; revisit if file size complaints).
- Combine/multiply with existing colors (`product-polish`).
- Export options UI beyond the button (file naming conventions, etc.).

## Decisions

- **Dual-parse loader.** `loadModel(file)` now returns `{ scene, document }`:
  GLTFLoader (+ DRACOLoader, MeshoptDecoder) parses an ArrayBuffer copy for
  the scene; `@gltf-transform` NodeIO (or a fetch-free equivalent reading the
  same ArrayBuffer) produces the Document. Rationale (vs. deriving three.js
  from the Document or vice versa): each library does what it is best at and
  neither becomes a translation layer; the cost is one extra parse.
- **Correspondence invariant.** Vertex N of a three.js mesh corresponds to
  vertex N of the same glTF primitive: GLTFLoader preserves primitive vertex
  order/count (including de-interleaving and Draco/meshopt decode), and
  gltf-transform never reorders primitives. Not merely assumed - guarded by
  `correspondence.test.ts` (bake -> export -> re-read -> compare against the
  in-memory result).
- **Injection mechanics.** For each primitive (same traversal order used to
  assemble bake input): `doc.createAccessor('COLOR_0', array, 3)` on the
  primitive. Existing COLOR_0 accessors are replaced (D4). Buffer layout is
  rebuilt by gltf-transform on save; untouched primitives keep their data.
- **Draco assets.** Preview decoding uses DRACOLoader with the wasm decoder
  copied into `dist/draco/` via vite-plugin-static-copy from three's package,
  loaded with a base-path-aware `setDecoderPath`. The gltf-transform document
  layer decodes draco with three's pure-JS decoder glue (no wasm fetch),
  created lazily only when a draco file is actually read (peek the GLB JSON
  for the extension). The app's document IO registers the full
  @gltf-transform/extensions set so any known extension passes through
  untouched. Alternative: CDN decoder - rejected, breaks the self-contained,
  no-external-requests constraint (docs/architecture.md #8).
- **Download.** `Blob` + object URL + synthetic `<a download>` click, filename
  `<original-name>-baked.glb`.
- **Fixtures.** A small script (`tools/make-fixtures` or test setup) builds
  fixture GLBs in-code via gltf-transform (rich fixture: animation + skin +
  extras + an extension; draco fixture via the Draco encoder wasm). Generated
  at test time into a temp dir, not committed binaries - keeps the repo lean
  and fixtures reviewable as code. If runtime encoder wasm proves flaky in
  CI, fall back to committing the two tiny binaries (decision point during
  implementation).

## Risks / Trade-offs

- [Correspondence breaks on some loader edge case (sparse accessors,
  interleaved + quantized combos)] -> the round-trip test is the tripwire;
  any failure blocks merge until either fixed or the edge case documented
  and rejected input.
- [gltf-transform and three disagree about a new extension some day] ->
  versions pinned; upgrade together in a dedicated task.
- [Draco encoder wasm in CI is slow/flaky] -> fallback documented above
  (commit binaries); not a design change.
- [Draco-compressed inputs are exported decompressed] -> the browser has no
  draco ENCODER (npm draco builds are node-only), so export strips
  `KHR_draco_mesh_compression` instead of re-encoding: COLOR_0 and all
  attributes keep exact float32 values at the cost of a larger file. Draco
  reading uses three's pure-JS decoder glue (no wasm fetch); preview keeps
  the wasm DRACOLoader. Meshopt inputs DO re-compress (encoder is
  browser-friendly ESM) and are registered lazily on first export.

## Open Questions

- None blocking. Exact rich-fixture extension choice (which KHR_* is most
  representative) is decided when writing the fixture generator.
