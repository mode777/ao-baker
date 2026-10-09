import type { SceneBakeData } from './assembly';

export type CombinePolicy = 'overwrite' | 'multiply';

/**
 * Applies the COLOR_0 combine policy in ONE place (result assembly) so the
 * preview and the exported document cannot diverge.
 *
 * - overwrite (default): baked values replace whatever the model had
 * - multiply: baked AO is composited onto the colors the model was LOADED
 *   with (not a previous bake's output); a model without existing colors
 *   multiplies onto white, which equals overwrite
 */
export function combineWithExisting(
  data: SceneBakeData,
  baked: Float32Array,
  policy: CombinePolicy,
): Float32Array {
  if (policy === 'overwrite' || data.existingColors.every((c) => c === null)) {
    return baked;
  }
  const out = new Float32Array(baked.length);
  let offset = 0;
  for (let m = 0; m < data.vertexCounts.length; m++) {
    const count = data.vertexCounts[m];
    const existing = data.existingColors[m];
    for (let v = 0; v < count; v++) {
      for (let ch = 0; ch < 3; ch++) {
        const bakedValue = baked[(offset + v) * 3 + ch];
        const base = existing ? existing[v * 3 + ch] : 1;
        out[(offset + v) * 3 + ch] = base * bakedValue;
      }
    }
    offset += count;
  }
  return out;
}
