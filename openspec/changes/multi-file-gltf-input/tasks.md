# Tasks

## 1. Bundle ingestion

- [x] 1.1 Add `src/loader/bundle.ts`: file-set index (lowercased decoded paths, exact-then-shortest-suffix URI resolution), primary detection (single .glb preferred, single .gltf via JSON `asset`, zero/multiple candidate errors), GLB/JSON/zip sniffing; verify with unit tests: suffix resolution incl. `%20` decoding, zero-candidate and multi-candidate errors
- [x] 1.2 Add zip input via fflate async `unzip` (entries -> index) and folder traversal via `webkitGetAsEntry` (recursive File collection, lazy byte reads); verify with unit tests: zip built with `fflate.zipSync` from an in-code bundle loads through the same collector

## 2. glTF packer

- [x] 2.1 Implement the `.gltf` -> GLB packer (`src/loader/pack.ts`): concatenate referenced buffers into one BIN chunk, embed external images as bufferViews with mimeType, leave data URIs untouched, emit GLB container; verify with unit test: packed GLB parses via gltf-transform and exposes identical accessor data
- [x] 2.2 Round-trip tests: packed GLB parsed by BOTH GLTFLoader and gltf-transform shows the same primitive count, POSITION values, and texture bytes as the source bundle; verify `npm test` green

## 3. Loader and validation integration

- [x] 3.1 Change `loadModel` input to `{ name, bytes }` (`LoadedFile`), route every ingestion path (GLB, embedded .gltf, packed bundle) through it; verify existing loader tests updated and green
- [x] 3.2 Extend the validation ladder: input sniffing replaces the bare GLB magic check (GLB / gltf JSON / zip / unsupported), missing-resource errors name the missing files, multi-asset errors list candidates; verify with unit tests

## 4. UI wiring

- [x] 4.1 Update the dropzone to collect all dropped files and expand directory entries (`webkitGetAsEntry`), add Files/Folder picker buttons and updated prompt copy; verify in headless browser: drop a generated multi-file bundle -> model renders with texture; drop a zip -> loads; drop junk -> clear error
- [x] 4.2 Wire picker buttons through the same `collectBundle` path; verify in headless browser: picking a generated folder loads the model

## 5. Documentation and release check

- [x] 5.1 Update README usage section (supported inputs: GLB, .gltf bundles, folders, zips, embedded .gltf; packed-GLB export note); verify README renders on GitHub
- [ ] 5.2 Full check `npm run lint && npm run typecheck && npm test && npm run build`; push and verify the deployed Pages URL accepts a multi-file bundle; report bundle-size delta (fflate)

## Workflow follow-up

- Archive this change after implementation.
