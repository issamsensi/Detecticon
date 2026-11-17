import { describe, expect, test } from 'vitest';
import {
  EXTRA_CREDITS_TEXT,
  getCompactCreditPages,
  getCompactCredits,
  LPC_CREDITS_TEXT,
} from './credits';

const rawValues = (field: string): string[] =>
  [...LPC_CREDITS_TEXT.matchAll(new RegExp(`^\\s*${field}:\\s*(.*)$`, 'gm'))]
    .flatMap((match) => (match[1] ?? '').split(','))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

describe('compact credits', () => {
  test('keeps every author and license from the full credits', () => {
    const compact = getCompactCredits();
    const authors = compact.authors.map((name) => name.toLowerCase());
    const licenses = compact.licenses.map((license) => license.toLowerCase());

    for (const name of rawValues('authors')) {
      expect(authors).toContain(name.toLowerCase());
    }
    for (const license of rawValues('licenses')) {
      expect(licenses).toContain(license.toLowerCase());
    }
  });

  test('produces four short pages with no long URLs and keeps the tool credits', () => {
    const pages = getCompactCreditPages();
    expect(pages).toHaveLength(4);

    const all = pages.join('\n');
    expect(all).toContain('Liberated Pixel Cup');
    expect(all).toContain('Phaser');
    expect(all).toContain('Devvit');
    expect(all).toContain('CREDITS.md');
    expect(all).not.toContain('http');
    expect(EXTRA_CREDITS_TEXT).toContain('Phaser');

    for (const page of pages) {
      expect(page.length).toBeLessThan(700);
      for (const line of page.split('\n')) {
        expect(line.length).toBeLessThanOrEqual(38);
      }
    }
  });
});
