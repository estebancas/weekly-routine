import { describe, it, expect } from 'vitest';
import { motionPlan } from '../../src/motion.js';

describe('motionPlan', () => {
  it('plays nothing on the first render (boot)', () => {
    expect(motionPlan(null, { preview: 2, isPreview: false })).toEqual({ swap: false, dockEnter: false });
  });

  it('plays the content swap when the previewed day changes', () => {
    expect(motionPlan({ preview: 2, isPreview: false }, { preview: 4, isPreview: true })).toEqual({
      swap: true,
      dockEnter: true,
    });
  });

  it('slides the dock in only when the bar was not already docked', () => {
    // docked -> docked (picking a second day while previewing): swap, but no dock re-entry
    expect(motionPlan({ preview: 4, isPreview: true }, { preview: 5, isPreview: true })).toEqual({
      swap: true,
      dockEnter: false,
    });
  });

  it('plays nothing when the preview is unchanged and the bar stays away (confirm)', () => {
    // Confirmar: selected catches up to preview; preview itself did not move
    expect(motionPlan({ preview: 4, isPreview: true }, { preview: 4, isPreview: false })).toEqual({
      swap: false,
      dockEnter: false,
    });
  });

  it('swaps back without a dock entry when the preview returns to the selected day (Volver)', () => {
    expect(motionPlan({ preview: 4, isPreview: true }, { preview: 2, isPreview: false })).toEqual({
      swap: true,
      dockEnter: false,
    });
  });
});
