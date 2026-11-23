import { expect } from 'vitest';
import { test } from '../test';
import { seenHowToKey } from './howto';

test('seen-howto flag is keyed per player without touching progress keys', () => {
  expect(seenHowToKey('snoo')).toBe('detecticon:seen-howto:snoo');
  expect(seenHowToKey('snoo')).not.toContain(':progress:');
});
