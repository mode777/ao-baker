# Design

## Context

`ao-bake-engine` ships the pure engine + worker host; `scaffold-web-app`
ships the viewer and loader service. This change connects them and owns
bake-lifecycle state.

## Goals / Non-Goals

**Goals:**

- Responsive, cancellable bake loop with clear state at all times.
- View modes that make bake quality judgeable (AO-only) without extra assets.
- Minimal vanilla-TS UI per D2 (docs/architecture.md #4).

**Non-Goals:**

- Export/download (`glb-export-pipeline`), presets (`product-polish`).
- Parameter persistence (localStorage) - later if asked for.
- Editing COLOR_0 by hand / painting.

## Decisions

- **Bake lifecycle state machine.** `idle -> baking -> {baked | idle(on
  cancel) | idle(on error)}`, one place (a small store module) emitting state
  the sidebar and viewer subscribe to. Guards: bake button disabled unless a
  model is loaded; cancel only in baking. Rationale: re-entrancy bugs (double
  bake, cancel-after-done) are state-machine bugs; encoding them once avoids
  scattered flags.
- **Worker lifecycle.** One persistent worker per session, created lazily on
  first bake. Cancel = `worker.terminate()` + respawn on next bake (simplest
  correct cancellation; BVH rebuild cost on rebake after cancel is accepted).
  Alternative: cooperative cancellation via message - rejected for v1, needs
  checkpoint plumbing in the kernel for little gain.
- **Progress UI.** Progress bar bound to worker progress messages; indeterminate
  bar during BVH build (kernel reports build as a phase before per-vertex
  progress; protocol already streams this).
- **COLOR_0 into preview.** On completion, per mesh: `geometry.setAttribute(
  'color', Float32BufferAttribute(result slice, 3))`. Slices precomputed by
  the client wrapper using per-mesh vertex counts (order matches bake input
  assembly - single assembly function shared by request building and result
  application).
- **View modes implementation.** original: set `material.vertexColors = false`
  + `needsUpdate` per material (cache originals); baked: `vertexColors = true`;
  AO-only: swap to a shared white `MeshBasicMaterial` with `vertexColors =
  true` (unlit x color = AO read). Restore originals on leaving AO-only.
  Materials cached per-mesh to avoid re-traversal.
- **Sidebar layout.** One column right of the canvas: parameters group, bake/
  cancel button, progress, view-mode segmented control. Absolute positioning
  over the canvas; no layout framework; CSS custom properties for theming.
- **Parameter defaults** (tunable, engine defaults): samples 32, radius 0.1
  (of bbox diagonal), strength 1.0, bias auto. Sliders with numeric readouts;
  ranges enforced in UI and re-validated by the engine.

## Risks / Trade-offs

- [Terminating a worker mid-transfer can leak the geometry buffers sent to
  it] -> they are copies (transferred structured-clones of views), not the
  app's live buffers; GC reclaims them.
- [Material cache drift when models reload] -> cache keyed with the scene,
  dropped on model reset.
- [Frequent re-bakes on slider drag] -> bake is explicit (button), sliders
  only stage values; no auto-rebake heuristics in v1.

## Open Questions

- None blocking; sidebar visual polish is implementation taste.
