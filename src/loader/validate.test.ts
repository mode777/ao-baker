import { describe, expect, it } from 'vitest';
import {
  validateScene,
  missingTexturesIssue,
  warningMessage,
  LARGE_SCENE_VERTEX_THRESHOLD,
} from './validate';
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

describe('missingTexturesIssue', () => {
  it('is empty when no textures are missing', () => {
    expect(missingTexturesIssue([])).toEqual([]);
  });

  it('names the missing files', () => {
    const issues = missingTexturesIssue(['a.png', 'b.jpg']);
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe('warning');
    expect(issues[0].message).toBe('Loaded without textures — missing: a.png, b.jpg');
  });

  it('caps the file list with an "and N more" tail', () => {
    const issues = missingTexturesIssue(['a.png', 'b.jpg', 'c.png', 'd.png', 'e.png']);
    expect(issues[0].message).toBe('Loaded without textures — missing: a.png, b.jpg, c.png … and 2 more');
  });
});

describe('warningMessage', () => {
  it('returns null when there are no warnings', () => {
    expect(warningMessage([{ kind: 'error', message: 'boom' }])).toBeNull();
    expect(warningMessage([])).toBeNull();
  });

  it('joins the large-scene and missing-texture warnings into one message', () => {
    const makeData = (total: number): SceneBakeData => ({
      meshes: [],
      vertexCounts: [total],
      objects: [],
      existingColors: [null],
    });
    const combined = warningMessage([
      ...missingTexturesIssue(['diffuse.png']),
      ...validateScene(makeData(LARGE_SCENE_VERTEX_THRESHOLD)),
    ]);
    expect(combined).toBe(
      'Loaded without textures — missing: diffuse.png Large scene (1,000,000 vertices): baking may take a while.',
    );
  });
});
