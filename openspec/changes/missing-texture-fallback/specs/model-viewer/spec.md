# Spec Delta

## ADDED Requirements

### Requirement: Missing external texture fallback

When a loaded model (a `.gltf` bundle or a GLB) references external texture
images that cannot be resolved from the provided files, the app SHALL load
the model without those textures (materials fall back to their non-texture
properties), SHALL show a non-blocking warning naming the missing texture
files, and SHALL keep the model available for preview, baking, and export as
usual. Unresolved external buffer (`.bin`) references SHALL continue to be a
load error.

#### Scenario: Missing texture files

- **WHEN** the user drops a `.gltf` together with its `.bin` but without some or all texture files it references
- **THEN** the model loads and renders without those textures, a non-blocking warning names the missing texture files, and baking remains available

#### Scenario: Partially resolved textures

- **WHEN** the user drops a `.gltf` with its `.bin` and only some of the referenced texture files
- **THEN** the provided textures are shown, the missing ones are dropped with a warning naming them, and no error is shown

#### Scenario: GLB with external texture references

- **WHEN** the user drops a GLB whose JSON references external texture image files
- **THEN** the model loads and renders without those textures, a non-blocking warning names the missing texture files, and baking remains available

#### Scenario: Dropped textures stay dropped through export

- **WHEN** a model loaded with missing textures is exported
- **THEN** the exported GLB is self-contained and contains no references to the missing texture files

#### Scenario: Missing buffer is still an error

- **WHEN** the user drops a `.gltf` whose referenced `.bin` file is not among the provided files
- **THEN** the app shows an error naming the missing file and remains usable
