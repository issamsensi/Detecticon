import { describe, expect, test } from 'vitest';
import { validateScheduleJson } from './schedule';

const validIds = new Set(['001', '002', '007', '015']);

describe('validateScheduleJson', () => {
  test('accepts an empty schedule object', () => {
    expect(validateScheduleJson('{}', validIds)).toEqual({ errors: [], entryCount: 0 });
  });

  test('accepts valid unique dates spaced more than 8 days apart for the same puzzle', () => {
    const raw = JSON.stringify({
      '2026-12-01': '007',
      '2026-12-05': '002',
      '2026-12-10': '007',
    });
    expect(validateScheduleJson(raw, validIds)).toEqual({ errors: [], entryCount: 3 });
  });

  test('rejects unknown puzzle ids', () => {
    const raw = JSON.stringify({ '2026-12-09': '999' });
    const result = validateScheduleJson(raw, validIds);
    expect(result.errors).toContainEqual(expect.stringContaining('unknown puzzle id "999"'));
  });

  test('rejects invalid UTC dates', () => {
    const raw = JSON.stringify({
      '2026-02-30': '001',
      '2026-12-9': '002',
    });
    const result = validateScheduleJson(raw, validIds);
    expect(result.errors).toContainEqual(expect.stringContaining('invalid UTC date "2026-02-30"'));
    expect(result.errors).toContainEqual(expect.stringContaining('invalid UTC date "2026-12-9"'));
  });

  test('rejects duplicate dates in raw JSON', () => {
    const raw = '{ "2026-12-09": "001", "2026-12-09": "002" }';
    const result = validateScheduleJson(raw, validIds);
    expect(result.errors).toContainEqual(expect.stringContaining('duplicate schedule date "2026-12-09"'));
  });

  test('rejects scheduling the same puzzle twice within 8 days', () => {
    const sevenDaysApart = JSON.stringify({
      '2026-12-01': '007',
      '2026-12-08': '007',
    });
    expect(validateScheduleJson(sevenDaysApart, validIds).errors).toContainEqual(
      expect.stringContaining('scheduled twice within 8 days')
    );

    const eightDaysApart = JSON.stringify({
      '2026-12-01': '007',
      '2026-12-09': '007',
    });
    expect(validateScheduleJson(eightDaysApart, validIds).errors).toContainEqual(
      expect.stringContaining('scheduled twice within 8 days')
    );
  });
});
