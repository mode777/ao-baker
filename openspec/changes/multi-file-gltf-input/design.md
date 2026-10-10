# Design

## Context

`loadModel(file)` takes a single `File`; the dropzone hands over
`dataTransfer.files[0]`; `main.ts` gates on the GLB magic
(`isGlbBinary`). Everything downstream of those bytes (three parse,
gltf-transform document, bake, export) is GLB-based by design. Main specs
`model-viewer` and `glb-export` own the affected behaviors.

## Goals / Non-Goals

**Goals:**

- Load `.gltf` + external resources handed over in one gesture: multi-file
  drop, folder drop, zip drop, or picker fallback.
- Keep every downstream stage unchanged: normalize non-GLB inputs to GLB
  bytes as close to the UI as possible.
- Clear errors when resources are missing or ambiguous.

**Non-Goals:**

- Fetching remote/http URIs or discovering files outside the user's gesture.
- Nested archives (zip inside zip).
- New texture-format support (KTX2/Basis stay as-is; preview of such
  textures in `.gltf` bundles behaves like the equivalent GLB today).

## Decisions

- **Pack to GLB instead of teaching both parsers about external resources.**
  A `.gltf` bundle is converted once, in memory, into a self-contained GLB
  (external `.bin` files concatenated into the BIN chunk; external image
  files embedded as bufferViews with mimeType; existing data URIs left
  untouched). The packed GLB then flows through the existing
  `loadModel`/bake/export pipeline byte-for-byte as any GLB. Rationale: one
  new mechanism instead of parallel resolution paths in GLTFLoader
  (`setURLModifier`) AND gltf-transform; the exporter gets "bundled input
  exports as packed GLB" for free. Cost: transient 2x buffer memory while
  packing - acceptable for the bundle sizes in question.
- **Resource bundle type in the loader boundary.**
  `loadModel(input: LoadedFile)` where `LoadedFile = { name: string; bytes:
  Uint8Array }` - the packing step happens before this boundary, so
  `loadModel` keeps a single-file contract. Ingestion lives in a new
  `src/loader/bundle.ts`: `collectBundle(entries: FileEntry[]):
  Promise<LoadedFile | LoadIssue>` shared by drop, folder, zip, and picker
  paths.
- **File-set index with path-suffix resolution.** Entries indexed by
  lowercased decoded path. Resolution order for a referenced URI:
  exact path, then progressively shorter path suffixes (so
  `textures/diffuse.png` matches `assets/textures/diffuse.png`).
  Shortest-suffix wins; ambiguity between equal-length different files
  resolves to first match (deterministic) - rare in practice.
- **Primary detection.** Among provided files: a single `.glb` (extension
  or magic) wins; otherwise a single `.gltf` (JSON with an `asset` member).
  Zero candidates -> "no model found" error; more than one -> error listing
  the candidates and asking for one asset per drop. Embedded `.gltf`
  dropped alone is its own primary; a `.gltf` with external references and
  no siblings errors naming every missing file.
- **Folder traversal via `webkitGetAsEntry`.** Collects `File` objects
  recursively without eagerly reading bytes (textures can be large); bytes
  are read only for the files actually referenced. Fallback for pickers:
  `<input webkitdirectory>` (same FileList shape, no entries API needed).
- **Zip via fflate's async `unzip`** (keeps the main thread free), entries
  converted to the same index structure. New runtime dependency `fflate`
  (~10 KB gz), no transitive deps.
- **Input sniffing replaces the bare GLB magic check** in the validation
  ladder: GLB magic -> GLB; `.gltf`/JSON-with-asset -> bundle path; `PK`
  magic -> zip; else the existing "not a glTF binary" style error, extended
  to mention supported inputs.
- **UI.** The dropzone keeps its window-level handlers but stops taking
  `files[0]`: it collects `dataTransfer.files` and, when a directory entry
  is present, expands entries recursively. Two picker buttons (Files,
  Folder) appear under the dropzone prompt; the empty-state copy mentions
  `.glb`/`.gltf`, folders, and zip.

## Risks / Trade-offs

- [Duplicate basenames in different folders make suffix resolution
  ambiguous] -> exact-path first, then shortest suffix; deterministic
  first-match tie-break documented; realistically rare in asset folders.
- [Large zips/bundles spike memory during packing] -> bytes read lazily
  where possible; packing allocates one output buffer + source views; the
  existing large-scene warning does not cover bundle size (noted as future
  work if users hit it).
- [`webkitGetAsEntry` inconsistencies across browsers] -> exercised by all
  Chromium/Firefox/Safari today; folder *picker* (`webkitdirectory`)
  provides a guaranteed path independent of the entries API.
- [Packer bugs would corrupt geometry/textures] -> round-trip tests: packed
  GLB parsed by BOTH three.js GLTFLoader and gltf-transform must expose
  identical primitive counts, POSITION values, and texture bytes as the
  source bundle.

## Open Questions

- None blocking.
