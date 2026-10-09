# Spec Delta

## Purpose

One-click bake parameter presets mapping to named quality levels, so users
get sensible results without understanding every parameter.

## ADDED Requirements

### Requirement: Quality presets

The app SHALL offer named presets - at minimum a fast preview preset, a
balanced default, and a high-quality preset - where selecting one applies its
parameter set immediately and parameters remain editable afterwards.

#### Scenario: Apply a preset

- **WHEN** the user selects the high-quality preset
- **THEN** the parameter controls update to that preset's values and the next bake uses them

#### Scenario: Preset then tweak

- **WHEN** the user applies a preset and then changes one parameter
- **THEN** the changed value is used by the next bake without the preset reverting it
