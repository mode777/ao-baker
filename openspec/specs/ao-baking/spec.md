# ao-baking Specification

## Purpose
Computes per-vertex ambient occlusion for a set of meshes entirely in the
browser: welding duplicated vertices, sampling hemisphere visibility against
the whole scene, and returning deterministic per-vertex color data suitable
for writing as glTF COLOR_0.

## Requirements

### Requirement: Vertex welding

The engine SHALL compute occlusion per unique vertex position and assign the
same value to every duplicated vertex at that position, so AO shows no seams
along UV cuts or normal splits.

#### Scenario: Duplicated vertices share AO

- **WHEN** a mesh contains two or more vertices at the same position (e.g. across a UV seam)
- **THEN** the engine produces identical AO values for all of them

### Requirement: Hemisphere visibility sampling

The engine SHALL estimate occlusion by cosine-weighted sampling of the
hemisphere around each vertex normal, with a configurable sample count per
vertex, and SHALL return fully lit values for unoccluded geometry.

#### Scenario: Unoccluded plane is fully lit

- **WHEN** baking a single flat plane facing open space
- **THEN** all vertex AO values equal 1.0 within sampling tolerance

#### Scenario: Concave geometry is darker than flat geometry

- **WHEN** baking a scene containing an open plane and an inside corner (e.g. the concave side of two joined quads)
- **THEN** the corner's vertex AO values are strictly lower than the plane's

### Requirement: Relative occlusion radius

The engine SHALL interpret the occlusion radius as a fraction of the scene
bounding-box diagonal, and geometry beyond the radius SHALL NOT contribute
occlusion.

#### Scenario: Distant geometry does not occlude

- **WHEN** a small object is baked with a second object placed farther away than the configured radius
- **THEN** the second object has no effect on the first's AO values

### Requirement: Ray origin bias

The engine SHALL offset ray origins along the vertex normal by a configurable
bias so that a surface does not occlude itself.

#### Scenario: Single plane self-occlusion

- **WHEN** baking a lone flat plane with default bias
- **THEN** no ray is reported as hit by the plane itself (AO stays 1.0)

### Requirement: Cross-mesh occlusion

The engine SHALL evaluate visibility against all meshes in the scene
combined, not only the mesh owning the vertex.

#### Scenario: Nearby mesh darkens facing surfaces

- **WHEN** two boxes are placed close together and the scene is baked
- **THEN** the facing sides of the boxes have lower AO than their outward sides

### Requirement: Deterministic output

Given identical mesh data, parameters, and seed, the engine SHALL produce
identical results across runs.

#### Scenario: Repeat bake is identical

- **WHEN** the same input is baked twice with the same seed and parameters
- **THEN** the two result arrays are exactly equal

### Requirement: World-space rest-pose evaluation

The engine SHALL evaluate geometry in world space using node transforms, in
the rest/bind pose for skinned meshes, ignoring morph targets, and SHALL
support quantized POSITION attributes.

#### Scenario: Transformed node

- **WHEN** a mesh is baked whose node has a non-identity transform (e.g. scaled and translated)
- **THEN** its AO matches the AO of the same mesh baked with the transform pre-applied to its vertices

### Requirement: Missing normals fallback

If a mesh primitive has no NORMAL attribute, the engine SHALL derive normals
for sampling (from face geometry) rather than failing.

#### Scenario: Primitive without NORMAL bakes

- **WHEN** baking a mesh whose geometry lacks a normal attribute
- **THEN** the bake completes and produces plausible occlusion (no error, no all-zero output)

### Requirement: RGB result buffer

The engine SHALL return occlusion as a Float32 RGB value per input vertex,
with the scalar AO broadcast to R = G = B.

#### Scenario: Output is RGB per vertex

- **WHEN** a bake completes
- **THEN** the result has exactly 3 floats per input vertex and R = G = B for every vertex

### Requirement: Off-main-thread execution

The engine SHALL be executable in a Web Worker and SHALL report monotonic
progress (0 to 1) during a bake; the main thread SHALL NOT be required to
participate in per-vertex work.

#### Scenario: Progress reporting from worker

- **WHEN** a bake runs in the worker
- **THEN** progress messages arrive monotonically increasing from 0 to 1 before the result is delivered
