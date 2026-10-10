# Proposal

## Why

When a dropped `.gltf` bundle references texture files that were not provided, the loader refuses the whole model ("Missing external resources"). Textures are optional for the app's purpose - AO baking works on geometry alone - so a model whose textures are missing should load untextured instead of failing, letting the user bake and export geometry without hunting down every texture file.

## What Changes

- Missing external texture images no longer abort loading: unresolvable external image URIs are dropped, the model loads without them, and the resulting packed GLB stays self-contained.
- Dropping an image also drops the texture defs referencing it and strips material (including extension) texture references to those textures, so materials fall back to their factors and the document stays valid for GLTFLoader, gltf-transform, and export.
- The app shows a non-blocking warning naming the missing textures when this happens (existing warning-banner pattern), instead of an error.
- Missing external `.bin` buffers remain a hard error: geometry cannot load without them (unchanged).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `model-viewer`: new requirement for missing-external-texture handling - load untextured with a warning instead of failing; only unresolvable buffers remain load errors.

## Impact

- `src/loader/bundle.ts` (`collectBundle`): distinguish buffer URIs from image URIs; only buffers are fatal when missing; surface missing texture URIs to the caller.
- `src/loader/pack.ts` (`packGltfToGlb`): accept known-missing image URIs and drop the corresponding images, textures, and material texture references instead of throwing.
- `src/ui/` load flow: present missing textures as a non-blocking warning (warning banner) rather than a load error.
- Tests: `bundle.test.ts`, `pack.test.ts`, plus load-flow warning tests.
- Spec reconciliation: the pending `multi-file-gltf-input` change's "load the model with all external resources resolved" wording predates this behavior; this change supersedes it for textures. If that change has not archived when this one applies, its delta's missing-resource wording is expected to be folded/adjusted at archive time (its `.bin` error scenario stays intact).
