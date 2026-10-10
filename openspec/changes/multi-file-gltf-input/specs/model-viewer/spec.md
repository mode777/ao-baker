# Spec Delta

## ADDED Requirements

### Requirement: Multi-file glTF input

The app SHALL accept a `.gltf` file dropped together with the external files
it references (`.bin` buffers, texture images) in one drop gesture, and SHALL
load the model with all external resources resolved. Resolution SHALL match
a referenced URI to a provided file by path-suffix comparison so
subdirectory-prefixed references (e.g. `textures/diffuse.png`) resolve when
the matching file was provided anywhere in the set.

#### Scenario: Drop a .gltf with buffers and textures

- **WHEN** the user drops a `.gltf` together with its `.bin` and texture files
- **THEN** the model renders completely, with geometry and all referenced textures visible

#### Scenario: Missing external resource

- **WHEN** the user drops a `.gltf` whose referenced `.bin` file is not among the dropped files
- **THEN** the app shows an error naming the missing file and remains usable

### Requirement: Folder drop

The app SHALL accept dropping a folder and SHALL load the `.glb` or `.gltf`
asset it contains, resolving external resources from anywhere within the
dropped folder's subdirectories.

#### Scenario: Drop an asset folder

- **WHEN** the user drops a folder containing `model.gltf`, `model.bin`, and a `textures/` subdirectory
- **THEN** the model loads with all resources resolved

#### Scenario: Folder without a loadable model

- **WHEN** the user drops a folder containing no `.glb` or `.gltf` file
- **THEN** the app shows an error stating no model was found and remains usable

### Requirement: ZIP bundle input

The app SHALL accept a `.zip` archive dropped as a single file and SHALL
load the `.glb` or `.gltf` asset inside it, resolving external resources
from the archive contents.

#### Scenario: Drop a zip bundle

- **WHEN** the user drops a zip containing a `.gltf` with external buffers and textures
- **THEN** the model loads with all resources resolved

#### Scenario: Zip without a loadable model

- **WHEN** the user drops a zip containing no `.glb` or `.gltf` file
- **THEN** the app shows an error stating no model was found and remains usable

### Requirement: Embedded glTF single-file input

The app SHALL accept a self-contained `.gltf` file (all resources inline as
data URIs) dropped as a single file, like a GLB.

#### Scenario: Drop an embedded .gltf

- **WHEN** the user drops a `.gltf` whose buffers and textures are inline data URIs
- **THEN** the model loads without requiring any additional files

### Requirement: File picker fallback

The app SHALL offer file-picker controls alongside the dropzone: a
multi-file selection and a folder selection, feeding the same loading
pipeline as drag-and-drop.

#### Scenario: Pick a folder

- **WHEN** the user uses the folder picker and selects an asset folder
- **THEN** the contained model loads as if the folder had been dropped
