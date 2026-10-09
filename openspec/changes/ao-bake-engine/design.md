# Design

## Context

Implements the kernel/mode architecture from docs/architecture.md #6 as a
pure library. No UI, no export - data in, Float32Array out. The app does not
consume this yet (`bake-workflow-ui` does).

## Goals / Non-Goals

**Goals:**

- Correct, seam-free, deterministic AO with unit tests on synthetic geometry.
- A kernel reusable by future bake modes (HDRI lighting) without rework.
- Worker-ready and main-thread-testable: identical code path both places.

**Non-Goals:**

- UI, progress display, export, COLOR_0 writing (changes 3-4).
- Multi-worker sharding; GPU/compute-shader baking.
- Denoising (vertex interpolation over faces is the smoother).

## Decisions

- **Kernel/mode split.** `kernel.ts` owns everything geometry-side: welding,
  combined world-space BVH, hemisphere sampling with seeded RNG, bias. A bake
  mode receives per-ray visibility (direction, hit distance or miss) and
  accumulates per-vertex RGB. AO mode: distance-weighted occlusion fraction.
  Rationale: HDRI lighting later only adds a mode (radiance lookup along
  unoccluded directions), never touches the kernel (docs/architecture.md #6).
- **Welding via spatial hash.** Quantize positions into cells (cell size =
  maxSceneExtent * 1e-6, clamped to float32 precision) and map duplicates to
  a canonical vertex; AO computed per canonical vertex, fanned out at the end.
  Alternative: three's mergeVertices - rejected, it rebuilds geometry and
  loses the index correspondence we must preserve for writeback.
- **three-mesh-bvh over a merged world-space proxy.** All meshes' triangles
  are transformed to world space (rest pose) into one non-indexed proxy
  geometry; a single MeshBVH is built over it. Rationale: cross-mesh
  occlusion (D3) for free and one BVH build instead of N. Vertex-level work
  still reads original per-mesh attributes.
- **Sampling.** Cosine-weighted hemisphere around the world-space vertex
  normal; ray contribution = clamp(hitDistance / radius, 0, 1); AO vertex
  value = 1 - strength * (1 - mean(contribution)). Seeded PRNG: mulberry32
  (tiny, deterministic, seedable per bake; one RNG stream shared across
  vertices, so sample counts per vertex stay reproducible).
- **Bias.** Default auto = 1e-3 * scene bbox diagonal, overridable. Applied
  along the vertex normal before casting.
- **Normals.** Use mesh NORMAL attributes (world-transformed); if absent,
  compute per-face normals assigned to the face's vertices (flat shading
  semantics).
- **API shape.**
  `bakeAO(input: BakeInput, params: AOBakeParams, seed: number): BakeResult`
  where `BakeInput` = per-mesh {position, normal?, index, worldMatrix} and
  `BakeResult` = Float32Array(length = totalVertexCount * 3). Pure function;
  the worker host wraps it and translates buffers. Rationale: the same
  function runs under Vitest without worker overhead.
- **Worker protocol.** Request: {id, mode: 'ao', meshes, params, seed} with
  transferable buffers; response stream: {id, progress} then {id, result,
  buffers}. `mode` discriminates future modes (protocol-compatible HDRI
  extension). Chunked vertex processing (yield every ~2k vertices) so
  progress is monotonic and granular.
- **Testing strategy.** Vitest, synthetic BufferGeometry fixtures built in
  code: open plane (AO=1), interior corner (darker), plane pair (facing sides
  dark), UV-split quad (weld equality), transformed node equivalence,
  determinism (two runs, deep equal), radius cutoff, bias no-self-hit.
  Fixtures are functions, not binary files - no repo bloat, readable intent.

## Risks / Trade-offs

- [Weld tolerance too coarse merges distinct close vertices] -> cell size
  tied to float32 precision and clamped; weld equality test guards the
  intended case; risk accepted for hair-thin geometry.
- [Non-indexed proxy doubles memory for very large scenes] -> acceptable to a
  few hundred thousand triangles; noted as future sharding trigger.
- [Shared RNG stream makes per-vertex samples depend on processing order] ->
  order is deterministic (vertex index order), covered by the determinism
  test; document that reordering inputs changes results.
- [three-mesh-bvh version coupling with three releases] -> peer versions
  pinned in package.json; upgrade together.

## Open Questions

- None blocking. Exact default sample count (32) and radius (0.1) will be
  tuned during `bake-workflow-ui` when previewable interactively.
