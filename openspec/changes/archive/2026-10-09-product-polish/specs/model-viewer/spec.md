# Spec Delta

## ADDED Requirements

### Requirement: Corrupt and invalid input errors

The app SHALL distinguish and clearly report: a file that is not a GLB, a
GLB that fails to parse, and a valid GLB containing no renderable meshes -
each without crashing or losing the ability to load another file.

#### Scenario: Non-GLB file

- **WHEN** the user drops a file whose contents are not glTF binary
- **THEN** an error names the problem (not a GLB) and the dropzone remains usable

#### Scenario: Valid GLB with no meshes

- **WHEN** the user drops a GLB that parses but contains no renderable meshes
- **THEN** an error states that no meshes were found and the app remains usable

### Requirement: Large-scene warning

When a loaded scene exceeds a defined vertex-count threshold, the app SHALL
show a non-blocking warning with a bake-time expectation, and SHALL NOT
prevent the user from proceeding.

#### Scenario: Oversized scene

- **WHEN** the user loads a scene above the vertex threshold
- **THEN** a warning is displayed and baking remains available
