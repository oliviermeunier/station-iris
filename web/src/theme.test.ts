import { describe, expect, it } from 'vitest';
import { initialTheme } from './theme';

describe('initialTheme', () => {
  it('prefers the stored choice', () => {
    expect(initialTheme('light', true)).toBe('light');
    expect(initialTheme('dark', false)).toBe('dark');
  });
  it('falls back to the device preference', () => {
    expect(initialTheme(null, true)).toBe('dark');
    expect(initialTheme('garbage', false)).toBe('light');
  });
});
