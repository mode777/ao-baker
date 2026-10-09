# Design

## Context

All pipeline capabilities (`model-viewer`, `ao-baking`, `bake-workflow`,
`glb-export`) are implemented. This change hardens edges and lowers the
learning curve; no architectural changes.

## Goals / Non-Goals

**Goals:**

- First-time users get good results without reading anything (presets).
- Pre-colored assets round-trip usefully (multiply).
- Bad inputs produce explanations, not silence or crashes.
- README answers "what is this / how do I use it / what are the limits".

**Non-Goals:**

- Auto-tuning / scene-analysis-driven parameter inference.
- Changing engine defaults or kernel behavior.
- i18n, mobile layout, PWA.

## Decisions

- **Presets are parameter snapshots, not engine modes.** `{ samples, radius,
  strength, bias }` per preset (e.g. preview 16 samples, balanced 32, high
  128 + auto bias); applying = setting controls, user can tweak after.
  Rationale: keeps presets out of the engine spec and out of the worker
  protocol entirely - pure UI concern.
- **Multiply semantics.** combined = existing * baked, where existing missing
  = 1.0 (white). Applied in one place on the main thread (result assembly,
  before both preview writeback and export injection) so preview and export
  cannot diverge. Rationale: doing it in the worker would leak policy into
  the bake request; doing it at injection only would desync preview.
- **Input validation ladder.** extension/magic check -> parse error mapping
  (loader vs decoder errors distinguished by message source) -> mesh
  presence check -> vertex-count threshold (warn >= 1,000,000 vertices;
  number chosen to be conservative for single-worker bakes, tunable
  constant). Errors surface in the dropzone area; warnings as a dismissible
  banner.
- **README structure:** one-line pitch, screenshot, 3-step usage, parameter
  table (mirroring docs/architecture.md #7 gotchas in user terms), "what
  happens to my file" fidelity note (D1 in user terms), limitations, and a
  link to docs/ for contributors. Screenshots generated from the dev build.

## Risks / Trade-offs

- [Multiply + very dark existing colors can crush to black] -> expected
  physical behavior; documented in README rather than special-cased.
- [Threshold warning becomes noise for power users] -> dismissible, and
  remembered per session only (no persistence).

## Open Questions

- None blocking.
