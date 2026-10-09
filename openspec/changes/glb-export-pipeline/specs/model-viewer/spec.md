# Spec Delta

## ADDED Requirements

### Requirement: Draco-compressed GLB input

The app SHALL load Draco-compressed GLB files for preview like any other
GLB, with the same framing and error behavior as uncompressed input.

#### Scenario: Drop a Draco GLB

- **WHEN** the user drops a Draco-compressed GLB onto the page
- **THEN** the model is rendered, centered and framed, exactly as an uncompressed GLB would be
