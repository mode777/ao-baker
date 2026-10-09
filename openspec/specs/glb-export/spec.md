# glb-export Specification

## Purpose
Exports the loaded GLB with baked ambient-occlusion vertex colors added:
COLOR_0 correctness, preservation of everything else in the document,
support for compressed inputs, and delivery as a browser download.

## Requirements

### Requirement: Export produces COLOR_0 matching the preview

The exported GLB SHALL contain a COLOR_0 attribute on every baked primitive
whose values match the previewed bake result for the same vertices.

#### Scenario: Round-trip color check

- **WHEN** a baked model is exported and the exported GLB is parsed back
- **THEN** each primitive's COLOR_0 values equal the previewed bake values for the corresponding vertices (within float32 tolerance)

### Requirement: Everything else is preserved

Export SHALL modify the document only by writing COLOR_0 attributes;
materials, textures, animations, skins, node hierarchy, extensions, extras,
and compression of unmodified data SHALL survive the round trip.

#### Scenario: Rich fixture survives

- **WHEN** a fixture containing animations, a skin, custom extras, and a KHR extension is loaded, baked, and exported
- **THEN** the exported document still contains all of those, unchanged except for added COLOR_0

### Requirement: Existing COLOR_0 is overwritten

When the input already has COLOR_0, export SHALL write the baked values in
place of the existing ones (default combine policy, D4).

#### Scenario: Pre-colored input

- **WHEN** a model that already carries COLOR_0 is baked and exported
- **THEN** the exported COLOR_0 contains the baked values, not the originals

### Requirement: Draco-compressed input

The app SHALL load Draco-compressed GLBs for preview, bake them, and export
the document with baked COLOR_0.

#### Scenario: Draco GLB end to end

- **WHEN** a Draco-compressed GLB is dropped, baked, and exported
- **THEN** the preview renders, the bake produces colors, and the exported GLB contains matching COLOR_0

### Requirement: Export download

When a bake has completed, the app SHALL offer an export action that
serializes the document to a GLB and downloads it as a file.

#### Scenario: Export button

- **WHEN** the user triggers export after a completed bake
- **THEN** a `.glb` file downloads whose contents parse as a valid glTF binary with COLOR_0 present

#### Scenario: Export disabled without a bake

- **WHEN** no bake has completed for the loaded model
- **THEN** the export action is unavailable

### Requirement: COLOR_0 combine policy

The app SHALL offer a combine policy for inputs that already have COLOR_0:
overwrite (default) or multiply - where multiply composites the baked AO onto
the existing colors - and the exported COLOR_0 SHALL reflect the active
policy, as shall the preview.

#### Scenario: Multiply preview matches export

- **WHEN** a pre-colored model is baked with multiply selected
- **THEN** the preview shows baked AO multiplied onto the existing colors and the exported COLOR_0 matches that preview

#### Scenario: Multiply without existing colors

- **WHEN** a model without existing COLOR_0 is baked with multiply selected
- **THEN** the result is identical to overwrite (existing colors default to white)
