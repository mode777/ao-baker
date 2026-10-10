import { describe, expect, it } from 'vitest';
import { validateScene, LARGE_SCENE_VERTEX_THRESHOLD } from './validate';
import type { SceneBakeData } from '../bake/assembly';

describe('validateScene', () => {
  const makeData = (total: number): SceneBakeData => ({
    meshes: [],
    vertexCounts: [total],
    objects: [],
    existingColors: [null],
  });

  it('errors on scenes without meshes', () => {
    const issues = validateScene(makeData(0));
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe('error');
    expect(issues[0].message).toContain('no renderable meshes');
  });

  it('passes small scenes silently', () => {
    expect(validateScene(makeData(100))).toEqual([]);
  });

  it('warns (non-blocking) above the vertex threshold', () => {
    const issues = validateScene(makeData(LARGE_SCENE_VERTEX_THRESHOLD));
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe('warning');
    expect(issues[0].message).toContain('Large scene');
  });
});
