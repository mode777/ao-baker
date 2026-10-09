# Tasks

## 1. Project hygiene and toolchain

- [x] 1.1 Create `.gitignore` (node_modules, dist, coverage, OS junk) - MUST exist before the first `npm install`; verify with `git status` staying clean after install
- [x] 1.2 Scaffold root app: `package.json`, `index.html`, `vite.config.ts` with `base: '/ao-baker/'`, `tsconfig.json` (strict), eslint flat config; verify with `npm run lint && npm run typecheck`
- [x] 1.3 Minimal README (what it is, dev/build commands); verify `npm run dev` serves the empty page

## 2. Viewer and loading

- [x] 2.1 Implement `src/viewer/` (three.js renderer, scene, RoomEnvironment lighting, OrbitControls with damping, resize handling); verify: dev server shows lit viewport, orbit/zoom/pan work
- [x] 2.2 Implement `src/loader/` service `loadModel(file)` using GLTFLoader + MeshoptDecoder; verify by loading an uncompressed and a meshopt GLB in dev
- [x] 2.3 Implement dropzone UI: full-page empty state, drag-and-drop wiring, frame-model-to-view on load (world-space bounds), inline error on invalid file; verify by dropping a valid GLB, a text file, and a corrupted .glb

## 3. Deployment

- [x] 3.1 Add `.github/workflows/deploy.yml` (npm ci, lint, typecheck, build, upload `dist/`, deploy-pages, concurrency group); verify the Action succeeds on push to main
- [x] 3.2 Smoke-check the deployed Pages URL: app loads, no 404s in the network tab, drop a GLB and orbit it

## Workflow follow-up

- Archive this change (all capabilities land in `openspec/specs/`) before
  starting `ao-bake-engine`.
