# AGENTS.md

## What this repo is

Browser-based tool (hosted on GitHub Pages at `mode777/ao-baker`) that:
- loads GLB files via drag-and-drop (all processing client-side, no backend)
- bakes ambient occlusion into vertex colors with user-tweakable parameters
- re-exports a GLB containing the baked vertex-color (`COLOR_0`) attributes

Status: greenfield. Only OpenSpec + OpenCode scaffolding exists so far; no app code, build config, or CI yet. Expect to create the web app from scratch.

## GitHub Pages constraints

- Static hosting only: everything (parsing, AO baking, export) must run in the browser.
- Pages serves from `/ao-baker/`, not `/` — bundler `base` paths and asset URLs must be relative or prefixed accordingly.

## OpenSpec workflow (this repo is spec-driven)

All feature work goes through OpenSpec changes in `openspec/changes/<name>/` (proposal, design, delta specs, tasks); main specs live in `openspec/specs/`. Use the installed workflows (`opsx propose` / `opsx apply` / `opsx archive`, also available as `.opencode/skills/`) rather than editing code ad hoc.

- `propose` creates planning artifacts only and must not touch code; implementation happens only in a separate, explicitly requested `apply` step.
- Validate artifacts with `openspec validate` before archiving; `archive` folds delta specs into the main specs.

## Repo layout gotchas

- `.opencode/` is OpenCode tooling (skills, commands, plugin deps in `.opencode/package.json` / `node_modules`) — not part of the app. Never put app code or dependencies there.
- No `.gitignore` exists yet; `.opencode/node_modules` is untracked. Add a `.gitignore` before the first `npm install` in the app scaffold.

## App toolchain (implemented)

- Package manager: npm. `package.json` at the repo root is the app;
  `.opencode/package.json` is OpenCode tooling — never mix them.
- Commands (run in order for a full check): `npm run lint` -> `npm run typecheck`
  -> `npm test` -> `npm run build`. `npm run build` already runs typecheck first.
- Dev server serves under `/ao-baker/` (Vite `base`), not `/`.
- Tests: Vitest, node environment; fixtures are generated in-code
  (`src/testing/`), no committed binaries. The bake engine is pure/headless.
- Deployment: GitHub Actions -> GitHub Pages on push to `main`; Pages source
  must be "GitHub Actions". Draco decoder wasm assets are copied into
  `dist/draco/` by `vite-plugin-static-copy`.
- Worker bundling: `src/baker/worker.ts` is loaded via
  `new Worker(new URL(...), { type: 'module' })`; keep baker code free of
  DOM/WebGL imports so it stays worker-safe.
