# Proposal

## Why

Many glTF assets are distributed as `.gltf` (JSON) with external `.bin`
buffers and texture files instead of a single GLB. ao-baker today accepts
only one dropped file with GLB magic, so users with multi-file assets are
blocked at step one. A browser cannot discover a dropped file's siblings on
its own - the user must hand over all files in one gesture (or a zip/folder).

## What Changes

- New loader input concept: a resource bundle - one primary file (`.glb` or
  `.gltf`) plus a resolver that maps a glTF-relative URI to a user-provided
  file.
- Multi-file drag-and-drop: dropping several files at once (`.gltf` +
  `.bin` + textures) loads the asset; URIs resolve by path-suffix match
  against the dropped set.
- Folder drag-and-drop: dropping a directory loads the asset inside it,
  recursing into subdirectories (via `webkitGetAsEntry`).
- ZIP drop: a `.zip` containing the bundle loads as one file (unpacked in
  memory with `fflate`).
- File-picker fallback alongside the dropzone: multi-select and
  directory-select buttons.
- Embedded `.gltf` (all resources inline as data URIs) loads as a single
  file like a GLB.
- Multi-file bundles are packed into a self-contained in-memory GLB that
  feeds the existing pipeline unchanged (preview, bake, export); exporting
  such an input produces a packed GLB.
- Dropzone prompt copy updated to mention `.glb`/`.gltf`, folders, and zips.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `model-viewer`: new input requirements - multi-file `.gltf` loading,
  folder drop, ZIP loading, embedded `.gltf` single-file loading, and a
  file-picker fallback (added as new requirements; no existing requirement
  text changes).
- `glb-export`: new requirement - an input loaded from a multi-file bundle
  exports as a packed, self-contained GLB (added; no existing requirement
  text changes).

## Impact

- `src/loader/` gains a bundle type (`loadModel` accepts primary bytes +
  URI resolver instead of a bare `File`), a glTF-to-GLB packer, a zip
  unpacker, and a file-set index (path-suffix URI resolution).
- `src/ui/dropzone.ts` handles multi-file drops, directory traversal
  (`webkitGetAsEntry`), and exposes picker buttons; `src/main.ts` wires
  bundles through validation (`isGlbBinary` magic check applies to GLB
  only; `.gltf` JSON gets its own sniffing).
- New runtime dependency: `fflate` (~10 KB gz). Three.js GLTFLoader already
  supports URL remapping via `LoadingManager.setURLModifier`.
- Test fixtures generated in code (multi-file bundle, zip archive); no
  committed binaries.
