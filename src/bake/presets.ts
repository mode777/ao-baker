import type { BakeUiParams } from '../bake/bakeState';

export interface BakePreset {
  id: string;
  label: string;
  description: string;
  params: Pick<BakeUiParams, 'samples' | 'radius' | 'strength' | 'biasAuto' | 'bias'>;
}

/**
 * Presets are parameter snapshots, not engine modes: applying one sets the
 * sidebar controls, which the user can then tweak freely.
 */
export const BAKE_PRESETS: BakePreset[] = [
  {
    id: 'preview',
    label: 'Preview',
    description: 'Fast, rough look at occlusion',
    params: { samples: 16, radius: 0.1, strength: 1, biasAuto: true, bias: 0.001 },
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Default quality (recommended)',
    params: { samples: 32, radius: 0.1, strength: 1, biasAuto: true, bias: 0.001 },
  },
  {
    id: 'high',
    label: 'High quality',
    description: 'Slow, smooth result for final assets',
    params: { samples: 128, radius: 0.1, strength: 1, biasAuto: true, bias: 0.001 },
  },
];

export const DEFAULT_PRESET_ID = 'balanced';
