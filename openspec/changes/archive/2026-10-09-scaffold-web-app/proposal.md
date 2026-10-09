# Proposal

## Why

The repo is greenfield: no app code, build config, or deployment exists. We
need the smallest deployable slice - a GLB viewer on GitHub Pages - to de-risk
the toolchain (Vite base path for Pages, TypeScript setup, CI deployment)
before any baking logic lands on top.

## What Changes

- Create a Vite + TypeScript (strict) web app at the repo root with three.js
  rendering an orbitable 3D viewport.
- GLB loading via drag-and-drop onto the page (uncompressed and meshopt GLBs;
  Draco support is deferred to `glb-export-pipeline`).
- Neutral studio lighting generated procedurally (RoomEnvironment) - no
  external HDR/texture assets.
- A full-screen dropzone empty state when no model is loaded.
- GitHub Actions workflow: build and deploy to GitHub Pages on push to main.
- Project hygiene: `.gitignore` (before first `npm install`), lint
  (typescript-eslint flat config), `typecheck` script, minimal README.

## Capabilities

### New Capabilities

- `model-viewer`: client-side loading and interactive preview of GLB models -
  drag-and-drop input, orbit/zoom/pan navigation, neutral lighting, and empty
  state. Owns model-preview UX requirements as the app evolves.

### Modified Capabilities

(none - no existing specs)

## Impact

- New root `package.json` (the app; `.opencode/package.json` remains OpenCode
  tooling, untouched), `src/` tree per docs/architecture.md module map
  (viewer + loader + ui only in this change), `index.html`, `vite.config.ts`
  with `base: '/ao-baker/'`, `.github/workflows/deploy.yml`.
- Dependencies added: `three`, dev: `typescript`, `vite`, `@types/three`,
  `eslint`, `typescript-eslint`.
- Preview loading uses three.js GLTFLoader directly; the gltf-transform
  document pipeline arrives in `glb-export-pipeline` and will re-use the
  loader service boundary established here.
