import { describe, expect, test } from 'vitest';
import {
  CREDIT_LINES_PER_PAGE,
  EXTRA_CREDITS_TEXT,
  getCompactCreditPages,
  getCreditPageLines,
  LPC_CREDITS_TEXT,
} from './credits';

const rawValues = (field: string): string[] =>
  [...LPC_CREDITS_TEXT.matchAll(new RegExp(`^\\s*${field}:\\s*(.*)$`, 'gm'))]
    .flatMap((match) => (match[1] ?? '').split(','))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

describe('compact credits', () => {
  test('keeps every author and license from the full credits in the pages', () => {
    const all = getCompactCreditPages().join('\n').toLowerCase();

    for (const name of rawValues('authors')) {
      expect(all).toContain(name.toLowerCase());
    }
    for (const license of rawValues('licenses')) {
      expect(all).toContain(license.toLowerCase());
    }
  });

  test('page count matches the generated content and fits the Credits scene', () => {
    const lines = getCreditPageLines();
    const pages = getCompactCreditPages();

    expect(lines.length).toBeGreaterThan(0);
    expect(pages).toHaveLength(Math.ceil(lines.length / CREDIT_LINES_PER_PAGE));
    expect(pages.join('\n')).toBe(lines.join('\n'));

    const all = pages.join('\n');
    expect(all).toContain('Liberated Pixel Cup');
    expect(all).toContain('Phaser');
    expect(all).toContain('Devvit');
    expect(all).toContain('CREDITS.md');
    expect(all).not.toContain('http');
    expect(EXTRA_CREDITS_TEXT).toContain('Phaser');

    for (const page of pages) {
      const pageLines = page.split('\n');
      expect(pageLines.length).toBeLessThanOrEqual(CREDIT_LINES_PER_PAGE);
      expect(page.length).toBeLessThan(700);
      for (const line of pageLines) {
        expect(line.length).toBeLessThanOrEqual(38);
      }
    }
  });
});
