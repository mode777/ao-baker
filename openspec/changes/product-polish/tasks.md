# Tasks

## 1. Presets and combine policy

- [x] 1.1 Implement preset definitions and selector (apply = set controls, tweakable after); verify in dev: each preset applies expected values and manual edits persist
- [x] 1.2 Implement multiply combine in result assembly (single site before preview writeback and export injection; missing colors = white); verify with unit tests: multiply on pre-colored fixture, multiply on clean fixture equals overwrite, preview slice == exported COLOR_0
- [x] 1.3 Add combine policy toggle (overwrite default) to sidebar and export flow; verify in dev with a pre-colored GLB in both policies

## 2. Robust inputs

- [x] 2.1 Implement input validation ladder (non-GLB, parse failure, no meshes, large-scene warning) with distinct messages and dismissible warning banner; verify in dev: text file, corrupted .glb, empty-scene .glb, oversized synthetic scene
- [x] 2.2 Add unit tests for the validation ladder classification; verify `npm test` green

## 3. Documentation and release check

- [x] 3.1 Write README (pitch, usage, parameters, fidelity note, limitations) with screenshots from the dev build; verify links and images render on GitHub
- [x] 3.2 Full manual pass on the deployed Pages build: presets, both combine policies, error cases, then `npm run lint && npm run typecheck && npm test` green; verify bundle size still reasonable (report `dist` sizes in the PR)

## Workflow follow-up

- Archive this change; roadmap complete - update docs/roadmap.md statuses.
