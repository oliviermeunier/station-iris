import { describe, expect, it } from 'vitest';
import { sanitize } from './sources';

describe('sanitize', () => {
  it('selected never empty', () => {
    expect(sanitize([])).toHaveLength(4);
    expect(sanitize(null)).toHaveLength(4);
    expect(sanitize(['nope'])).toHaveLength(4);
  });
  it('keeps known ids', () => {
    expect(sanitize(['gfs_seamless', 'nope'])).toEqual(['gfs_seamless']);
  });
});
