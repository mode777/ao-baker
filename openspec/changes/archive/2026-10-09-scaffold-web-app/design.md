# Design

## Context

Greenfield repo; nothing exists yet. Global architecture and stack rationale
are fixed in `docs/architecture.md` (D1-D4, module map). This change
establishes the skeleton those decisions assume.

## Goals / Non-Goals

**Goals:**

- Deployable app at the Pages URL with a working GLB viewer.
- Module boundaries (viewer / loader / ui) that later changes plug into
  without restructuring: baking, export, and the gltf-transform document
  pipeline must fit inside them.
- Toolchain hygiene: strict TS, lint, typecheck, CI deployment from day one.

**Non-Goals:**

- Any baking, export, or parameter UI (changes 2-4).
- Draco-compressed input support (arrives with `glb-export-pipeline`).
- Tests (no behavior worth unit-testing yet; Vitest arrives with
  `ao-bake-engine`, which adds the CI test job).

## Decisions

- **Vite + TypeScript strict, single page at repo root.** The app is the only
  thing in this repo; no monorepo scaffolding. Alternative: plain esbuild -
  rejected, Vite gives dev server, worker handling, and `base` config for
  free.
- **`base: '/ao-baker/'`** in `vite.config.ts` (explicit project-site path per
  docs/architecture.md #7). Alternative: `base: './'` - works, but explicit
  matches the Pages docs and fails loudly if misconfigured.
- **Loader service boundary.** `loader/` exposes `loadModel(file)` returning
  a three.js scene graph; implemented today with GLTFLoader (+ MeshoptDecoder,
  which is pure JS and trivial to wire). `glb-export-pipeline` extends this
  boundary to also return the gltf-transform Document from the same bytes -
  the rest of the app never touches GLTFLoader directly, so the swap is local.
- **RoomEnvironment** for lighting: procedural, no assets to host, no CDN.
- **Worker-ready structure.** No bake worker yet, but `vite.config.ts` and TS
  config must not preclude `new Worker(new URL(...), { type: 'module' })`
  (default Vite behavior; just don't adopt anything that breaks it).
- **GitHub Actions deploy** using `actions/configure-pages` ->
  `upload-pages-artifact` of `dist/` -> `actions/deploy-pages`, triggered on
  push to main. Concurrency group cancels superseded runs.
- **Lint:** eslint flat config + typescript-eslint (recommended, type-checked
  rules off for speed); `npm run lint` and `npm run typecheck` (tsc --noEmit).
  Alternative: Biome - fine either way; eslint chosen for ecosystem familiarity.

## Risks / Trade-offs

- [Bundle ~700KB min (~200KB gz) before any baking code] -> acceptable for a
  tool app on Pages; no framework added later keeps this roughly constant.
- [GLTFLoader applies a Y-up root rotation on load] -> viewer framing logic
  must use world bounding boxes after updateMatrixWorld, not raw local bounds.
- [Meshopt decoder needs to be registered per-load] -> wire it inside the
  loader service only, once.
- [Pages deployment breaks silently if `base` regresses] -> manual smoke check
  of the deployed URL is in tasks; a future change may add a deploy smoke test.

## Open Questions

- None blocking. Exact visual styling (dark/light theme) is left to
  implementation taste within a minimal neutral look.
