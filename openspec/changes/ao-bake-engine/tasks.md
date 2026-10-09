# Tasks

## 1. Engine foundation

- [ ] 1.1 Add Vitest + `npm test` script and a CI test step in the deploy workflow; verify CI runs tests on push
- [x] 1.2 Implement weld map (spatial hash over positions, canonical vertex fan-out) in `src/baker/kernel.ts`; verify with unit test: duplicated vertices across a UV seam map to one canonical vertex
- [x] 1.3 Implement world-space proxy assembly (per-mesh transforms, rest/bind pose, missing-NORMAL fallback) and merged-scene MeshBVH build; verify with unit test: a translated/rotated mesh bakes identically to a pre-transformed copy

## 2. Sampling and AO mode

- [x] 2.1 Implement seeded PRNG (mulberry32) and cosine-weighted hemisphere sampling with bias offset; verify with statistical unit test (mean cos-weight over many samples within tolerance)
- [x] 2.2 Implement AO accumulation mode (distance-weighted occlusion fraction, radius relative to bbox diagonal, strength curve) producing Float32 RGB; verify with unit tests: open plane = 1.0, interior corner strictly darker, distant object beyond radius has no effect, lone plane shows no self-hits
- [x] 2.3 Implement `bakeAO` facade (input assembly, per-mesh attribute reads, fan-out of welded values); verify with unit test: UV-split quad produces identical AO at shared positions, and result length = 3 floats per input vertex

## 3. Worker host and protocol

- [x] 3.1 Define `src/baker/protocol.ts` (mode-discriminated request/response, progress messages) and `src/baker/worker.ts` host with transferable buffers and chunked progress; verify with a worker integration test (vitest web-worker pool or a main-thread fallback shim): progress monotonic 0->1, result identical to direct `bakeAO` call
- [x] 3.2 Add determinism test: two full bakes with same seed produce deep-equal arrays; verify `npm test` green
- [x] 3.3 Run `npm run lint && npm run typecheck && npm test` green; confirm no DOM/WebGL imports from `src/baker/` (grep check) so the engine stays worker-safe

## Workflow follow-up

- Archive this change before starting `bake-workflow-ui`.
