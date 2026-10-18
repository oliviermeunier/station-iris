import { describe, expect, it } from 'vitest';
import { compass, compassShort, gustWord, meanDirection } from './wind';

describe('wind', () => {
  it('names directions', () => {
    expect(compass(0)).toBe('nord');
    expect(compass(243)).toBe('sud-ouest');
    expect(compass(359)).toBe('nord');
    expect(compassShort(268)).toBe('O');
  });

  it('averages directions on the circle', () => {
    expect(meanDirection([350, 10])).toBe(0);
    expect(meanDirection([240, 244, null, 239])).toBe(241);
    expect(meanDirection([])).toBeNull();
    // Opposite winds: no meaningful direction.
    expect(meanDirection([90, 270])).toBeNull();
  });

  it('words gusts', () => {
    expect(gustWord(30)).toBe('');
    expect(gustWord(55)).toBe('vent fort');
    expect(gustWord(95)).toBe('tempête');
  });
});
