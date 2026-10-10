# Tasks

## 1. Bundle layer: tolerate missing textures

- [x] 1.1 In `src/loader/bundle.ts`, split external URIs into buffer and image lists; missing buffers raise the existing `BundleError` (message naming them), missing image URIs are returned as deduped `missingTextures` on the `LoadedFile`-shaped result; verify with unit tests in `bundle.test.ts`: missing `.bin` still throws naming the file, missing texture(s) alone load, missing texture plus missing buffer throws, dedupe of a texture referenced by multiple images
- [x] 1.2 Verify the standalone `.gltf` (no companion files, data-URI buffer, external textures) case now loads untextured instead of erroring; verify `npm test` green

## 2. Packer: strip unresolved images and their references

- [x] 2.1 In `src/loader/pack.ts`, drop images whose `resolve` yields null (buffers keep throwing); verify with unit test: missing image produces a GLB whose JSON has no reference to the dropped URI
- [x] 2.2 Implement the texture-strip surgery: remove textures whose `source` targeted a dropped image, strip material texture references to removed textures (core PBR slots explicitly, extension textureInfo slots via an `extensions` walk), remap surviving `textures[].source` and material texture `index` values; verify with unit tests: a fixture with interleaved kept/dropped images leaves surviving textures/images correctly reindexed, no dangling indices, materials keep factor properties, GLTFLoader and gltf-transform both parse the packed GLB

## 3. Warning surfacing in the load flow

- [x] 3.1 In `src/main.ts` (`loadFromEntries`), convert `missingTextures` into a warning message ("Loaded without textures — missing: …", capped list with "… and N more"), join with `validateScene` warnings, and show the combined message in the existing banner; verify in headless browser: drop a generated bundle missing a texture → model renders, warning names it, bake and export still run and the exported GLB has no references to the dropped texture; verify the combined-message path (large scene + missing texture) in a unit or headless test

## 4. Full check

- [x] 4.1 Run `npm run lint && npm run typecheck && npm test && npm run build`; verify all green and `dist` builds cleanly

## 5. GLB input with external texture references

- [x] 5.1 In `src/loader/pack.ts` (+ `glbContainer.ts` parse helper), add GLB strip: a GLB whose JSON references external image URIs has those images (and their textures/material references) dropped and is rebuilt with its original BIN chunk; GLBs without external image references pass through byte-for-byte; verify with unit tests: external-image GLB loads untextured with `missingTextures` reported, embedded/data-URI images untouched, exported/preview parse works, external buffer URIs still error
- [x] 5.2 Verify end-to-end in headless browser: drop a GLB referencing an external texture → model renders, warning names it, bake and export run, exported GLB has no reference to the dropped texture; verify combined warning still works; then `npm run lint && npm run typecheck && npm test && npm run build` green
