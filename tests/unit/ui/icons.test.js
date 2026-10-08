import { describe, it, expect } from 'vitest';
import { icon } from '../../../src/ui/icons.js';

describe('icon', () => {
  it.each(['play', 'copy', 'check'])('renders a decorative %s svg', (name) => {
    const svg = icon(name);
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.querySelector('path')).not.toBeNull();
  });

  it('returns a fresh node each call', () => {
    expect(icon('play')).not.toBe(icon('play'));
  });

  it('throws on an unknown icon', () => {
    expect(() => icon('nope')).toThrow(/unknown icon/i);
  });
});
