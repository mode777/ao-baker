# model-viewer Specification

## Purpose
Client-side loading and interactive 3D preview of GLB models in the browser:
drag-and-drop input, orbit/zoom/pan navigation, and neutral lighting, with no
server-side processing.

## Requirements

### Requirement: GLB loading via drag-and-drop

The app SHALL accept a GLB file dropped onto the page and render all meshes
of the model in the viewport, centered and framed to fit the view.

#### Scenario: Drop a valid GLB

- **WHEN** the user drops a valid (uncompressed or meshopt-compressed) GLB file onto the page
- **THEN** the model's meshes are visible in the viewport, centered and scaled to fit

#### Scenario: Drop an unsupported file

- **WHEN** the user drops a file that is not a GLB (or a GLB that fails to parse)
- **THEN** the app shows an inline error message and remains functional for another drop

### Requirement: Orbit navigation

The viewport SHALL let the user rotate the model around a focal point (orbit),
zoom via wheel/pinch, and pan via drag with a secondary button or modifier.

#### Scenario: Orbit, zoom, pan

- **WHEN** the user drags with the primary button, scrolls the wheel, or drags with a secondary button/modifier
- **THEN** the camera orbits, dollies, or pans respectively, with smoothed (damped) motion

### Requirement: Neutral procedural lighting

The viewport SHALL light models using a procedurally generated neutral studio
environment and SHALL NOT download any external texture or lighting assets.

#### Scenario: Model lit without external assets

- **WHEN** a model is displayed
- **THEN** it is lit by a neutral studio environment and the app performed no network requests for lighting assets

### Requirement: Empty state dropzone

Before any model is loaded, the app SHALL show a full-page dropzone prompting
the user to drop a GLB file.

#### Scenario: Initial page load

- **WHEN** the page loads with no model
- **THEN** a dropzone prompt is displayed and the viewport shows no model

### Requirement: GitHub Pages deployment

On every push to the default branch, the app SHALL be built and deployed to
GitHub Pages such that the site and its assets resolve under the `/ao-baker/`
base path.

#### Scenario: Site served under project base path

- **WHEN** the deployed site is opened at the GitHub Pages URL
- **THEN** the app loads with all scripts, styles, and assets resolving (no 404s) under the `/ao-baker/` base path

### Requirement: Draco-compressed GLB input

The app SHALL load Draco-compressed GLB files for preview like any other
GLB, with the same framing and error behavior as uncompressed input.

#### Scenario: Drop a Draco GLB

- **WHEN** the user drops a Draco-compressed GLB onto the page
- **THEN** the model is rendered, centered and framed, exactly as an uncompressed GLB would be

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
