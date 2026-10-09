# Roadmap

Sequenced OpenSpec changes for ao-baker. Each step ships independently usable
value to the GitHub Pages site. Global architecture and rationale:
[architecture.md](./architecture.md).

| # | Change | Capability | Ships |
|---|--------|------------|-------|
| 1 | `scaffold-web-app` | `model-viewer` | Deployed app at the Pages URL: drag-and-drop GLB, orbit, studio lighting |
| 2 | `ao-bake-engine` | `ao-baking` | Headless bake engine (Web Worker) + unit tests; no UI |
| 3 | `bake-workflow-ui` | `bake-workflow` | Params sidebar, bake with progress, baked/AO-only preview, re-bake, cancel |
| 4 | `glb-export-pipeline` | `glb-export` (+ `model-viewer` compressed input) | The product contract: original document + COLOR_0 exported and downloaded; Draco/meshopt inputs |
| 5 | `product-polish` | `presets` (+ deltas) | Presets, combine-with-existing-COLOR_0 option, error states, README |

Sequencing rationale:

- **1 first** de-risks deployment and the Pages base path with the smallest
  possible surface; everything after lands on a live site.
- **2 is pure engine** - the risky math (welding, sampling, BVH) is built and
  tested headless, independent of UI churn.
- **3 wires the engine in**; the tool becomes usable for baking even before
  export exists.
- **4 delivers the core promise** (round-trip fidelity) and compressed-input
  support; it is the change most backed by regression tests.
- **5 is trust and ergonomics** polish once the pipeline is stable.

Status: all five changes are implemented (all tasks checked); the change
artifacts await archive via `/opsx-archive`. Implemented in order; archive each
before the next.

## Deliberately out of scope (for now)

- **HDRI-based lighting bake** - the kernel/mode split in
  [architecture.md](./architecture.md#6-bake-engine-kernel--mode-split-hdri-extension-point)
  exists precisely so this can be added later as a new bake mode. Not a
  roadmap item today.
- Multi-worker bake sharding (single worker is fine to a few hundred thousand
  vertices; revisit if users hit walls).
- Browser E2E tests (puppeteer), i18n, mobile UX, PWA/offline.
- Alternatives considered and rejected: three.js GLTFExporter round-trip
  export, React/R3F UI, screen-space AO (not bakeable into vertex colors).
