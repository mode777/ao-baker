# Design

## Context

All input funnels through one pipeline: `collectBundle` (src/loader/bundle.ts) turns dropped files into a single self-contained GLB, then `loadModel` parses it in parallel with GLTFLoader (preview) and gltf-transform (document/export source of truth). `collectBundle` collects every external URI — buffers and images alike — and throws a `BundleError` when any is unresolvable; `packGltfToGlb` (src/loader/pack.ts) re-checks and throws too. The UI has a single dismissible warning banner fed by `LoadIssue[]` from `validateScene` (src/loader/validate.ts); `loadFromEntries` (src/main.ts) currently surfaces only the first warning message. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**

- Unresolvable external image URIs in a `.gltf` bundle produce an untextured load, not an error.
- The packed GLB stays valid and self-contained so preview, bake, and export work unchanged.
- The user is told which textures were dropped, via the existing warning banner.
- Unresolvable `.bin` buffers keep failing the load with a message naming them.

**Non-Goals:**

- No change to GLB input (already self-contained) or to texture decoding (KTX2/Basis behavior stays as-is).
- No new file-resolution attempts (no network fetches, no prompting to re-drop).
- No partial-asset recovery for missing buffers.

## Decisions

- **D1: Split fatal vs. tolerated externals in `collectBundle`.** Partition external URIs into buffer URIs and image URIs. Missing buffer URIs raise the existing `BundleError`; missing image URIs are collected and returned to the caller (`LoadedFile` gains `missingTextures: string[]`, deduped). Alternatives: keep one fatal list with a flag (leaks policy into the message), or resolve lazily inside the packer (moves the boundary decision out of the bundle layer where the URI context lives).

- **D2: Strip references, don't fake textures.** For each missing image the packer removes: the image def, every texture def whose `source` pointed at it, and every material texture reference pointing at a removed texture — then remaps surviving `textures[].source` and material texture `index` values. Materials fall back to their factor properties, which is what "untextured" means. Alternatives rejected: embedding a 1×1 placeholder (white is wrong for metallicRoughness/normal slots — it changes material meaning instead of removing it) and keeping dangling textures (invalid glTF, GLTFLoader/gltf-transform would reject or warn). Core PBR slots (`baseColorTexture`, `metallicRoughnessTexture`, `normalTexture`, `occlusionTexture`, `emissiveTexture`) are handled explicitly; extension slots (clearcoat/sheen/specular/transmission/volume/iridescence/diffuse-transmission/anisotropy from `PRESERVED_EXTENSIONS`) are handled by a textureInfo walk over each material's `extensions` objects with an `index` field. KHR_materials_variants and unlit carry no extra texture slots.

- **D3: Warning flows through the existing `LoadIssue` pattern.** `loadFromEntries` converts `missingTextures` into a warning ("Loaded without textures — missing: a.png, b.jpg"), joins it with `validateScene` warnings, and shows the combined message in the banner (replacing today's first-warning-only behavior; messages joined with a space). No new UI surface, no error styling.

- **D4: Packer contract change mirrors the bundle policy.** `packGltfToGlb` drops images whose `resolve` yields null instead of throwing; buffers still throw (the bundle layer guarantees buffers are present, so this stays a defensive invariant). This keeps the packer usable for future callers without re-encoding the missing-set rule.

## Risks / Trade-offs

- [Index surgery corrupts the document] → round-trip unit tests: with missing images present, the packed GLB parses via gltf-transform AND GLTFLoader; surviving images/textures/materials keep their data; no dangling indices; exported GLB self-contained.
- [Silent-looking degradation] → the warning names every dropped file; users who need the textures still see exactly what to provide.
- [Combined banner message gets long] → cap: list up to a few filenames, then "… and N more".
- [Spec drift with the unarchived `multi-file-gltf-input` change] → its delta's "all external resources resolved" wording and buffer-error scenario predate this; reconciliation note lives in proposal.md and should be handled when archiving (this change supersedes texture behavior; the `.bin` error scenario stands).
