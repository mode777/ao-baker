# Spec Delta

## Purpose

The end-to-end in-app baking experience: adjusting bake parameters, running a
bake with visible progress while the app stays responsive, previewing baked
vertex colors on the orbitable model, and iterating via re-bake and cancel.

## ADDED Requirements

### Requirement: Parameter sidebar

The app SHALL expose bake parameters - samples per vertex, occlusion radius,
strength, and bias - with their current values visible, bounded to valid
ranges, and editable before and between bakes.

#### Scenario: Adjust parameters

- **WHEN** the user changes any parameter control (e.g. samples 8-256)
- **THEN** the sidebar reflects the new value and the value is used by the next bake

### Requirement: Bake execution with progress

The app SHALL run bakes in the background worker and show a progress
indicator advancing with worker progress messages; the viewport and controls
SHALL remain responsive during a bake.

#### Scenario: Bake completes with progress

- **WHEN** the user starts a bake on a loaded model
- **THEN** a progress indicator advances from 0 to 100% and the model's baked state is applied on completion

#### Scenario: UI stays responsive

- **WHEN** a bake is running
- **THEN** the camera can still be orbited/zoomed without visible main-thread stalls

### Requirement: Baked preview

On bake completion, the app SHALL write the baked RGB values into the loaded
model's geometries as the vertex color attribute and display them when a
vertex-color view mode is active.

#### Scenario: Colors appear after bake

- **WHEN** a bake completes with the baked view mode active
- **THEN** the model is rendered with the baked vertex colors visible

### Requirement: View mode switching

The app SHALL provide three view modes switchable at any time: original
(materials without vertex colors), baked (materials with vertex colors), and
AO-only (unlit white base multiplied by vertex colors).

#### Scenario: Switch view modes after a bake

- **WHEN** the user switches between original, baked, and AO-only after a completed bake
- **THEN** the viewport updates immediately to reflect the selected mode

#### Scenario: Modes without a bake

- **WHEN** no bake has completed yet and a baked or AO-only mode is selected
- **THEN** the model renders without baked colors (original appearance) and the mode takes effect once a bake completes

### Requirement: Re-bake

The app SHALL allow starting a new bake at any time after (or instead of) a
previous one; the most recent completed bake replaces earlier colors in the
preview.

#### Scenario: Re-bake with new parameters

- **WHEN** the user changes parameters and bakes again after a completed bake
- **THEN** the preview shows only the new bake's colors once it completes

### Requirement: Cancel bake

The app SHALL allow canceling an in-flight bake; cancellation discards that
bake's partial work, keeps any previously completed bake's colors, and
returns the workflow to an idle state.

#### Scenario: Cancel during bake

- **WHEN** the user cancels while a bake is running
- **THEN** the bake stops, prior baked colors (if any) remain in the preview, and a new bake can be started

### Requirement: Bake state resets with model

Loading a new model SHALL clear all bake results and parameters back to
defaults.

#### Scenario: Load a new model

- **WHEN** a model is loaded after a previous bake
- **THEN** the app shows the new model with no baked colors and default parameters
