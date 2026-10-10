# Spec Delta

## ADDED Requirements

### Requirement: Bundled input exports as packed GLB

An asset loaded from a multi-file bundle, folder, or zip SHALL export as a
packed, self-contained GLB containing all buffers and textures.

#### Scenario: Export a bundled input

- **WHEN** an asset loaded from a `.gltf` bundle is baked and exported
- **THEN** the downloaded GLB is self-contained (no external references) and opens standalone
