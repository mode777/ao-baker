# Spec Delta

## ADDED Requirements

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
