import { describe, expect, it } from 'vitest';
import { BakeStore, DEFAULT_UI_PARAMS } from './bakeState';

describe('BakeStore', () => {
  it('starts idle with default params', () => {
    const store = new BakeStore();
    expect(store.lifecycle).toBe('idle');
    expect(store.params).toEqual(DEFAULT_UI_PARAMS);
    expect(store.canStartBake()).toBe(false);
  });

  it('guards double-bake and bake-without-model', () => {
    const store = new BakeStore();
    store.resetModel(true);
    store.startBake();
    expect(store.lifecycle).toBe('baking');
    store.startBake(); // ignored
    expect(store.lifecycle).toBe('baking');
  });

  it('cancel without prior result returns to idle, with result to baked', () => {
    const store = new BakeStore();
    store.resetModel(true);
    store.startBake();
    store.bakeCancelled();
    expect(store.lifecycle).toBe('idle');

    store.startBake();
    store.bakeFinished();
    expect(store.lifecycle).toBe('baked');
    store.startBake();
    store.bakeCancelled();
    expect(store.lifecycle).toBe('baked');
  });

  it('resetting the model clears results and parameters', () => {
    const store = new BakeStore();
    store.resetModel(true);
    store.stageParam('samples', 128);
    store.startBake();
    store.bakeFinished();
    store.resetModel(true);
    expect(store.lifecycle).toBe('idle');
    expect(store.params).toEqual(DEFAULT_UI_PARAMS);
    expect(store.progress).toBe(0);
  });

  it('ignores progress outside baking', () => {
    const store = new BakeStore();
    store.resetModel(true);
    store.setProgress(0.5);
    expect(store.progress).toBe(0);
  });

  it('maps staged params to engine params (auto bias)', () => {
    const store = new BakeStore();
    store.resetModel(true);
    expect(store.engineParams()).toEqual({
      samples: 32,
      radius: 0.1,
      strength: 1,
      bias: null,
    });
    store.stageParam('biasAuto', false);
    store.stageParam('bias', 0.01);
    expect(store.engineParams().bias).toBe(0.01);
  });

  it('notifies subscribers on transitions', () => {
    const store = new BakeStore();
    let events = 0;
    store.subscribe(() => events++);
    store.resetModel(true);
    store.startBake();
    store.bakeFinished();
    expect(events).toBe(3);
  });
});
