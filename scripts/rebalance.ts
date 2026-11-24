import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Puzzle, Suspect } from '../src/shared/types';

const PUZZLES_DIR = path.resolve(process.cwd(), 'src/shared/puzzles');
const POSITION_COUNT = 4;

type PuzzleFile = {
  file: string;
  raw: string;
  puzzle: Puzzle;
};

/** Stable per-id ordering so reruns always assign the same target positions. */
const idHash = (id: string): number => {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

/** Preserve the existing file indentation style. */
const indentOf = (raw: string): string => /^\{\r?\n([ \t]+)/.exec(raw)?.[1] ?? '  ';

const main = async (): Promise<void> => {
  const files = (await readdir(PUZZLES_DIR))
    .filter((file) => file.endsWith('.json'))
    .sort();

  const entries: PuzzleFile[] = [];
  for (const file of files) {
    const fullPath = path.join(PUZZLES_DIR, file);
    const raw = await readFile(fullPath, 'utf8');
    entries.push({ file, raw, puzzle: JSON.parse(raw) as Puzzle });
  }

  entries.sort(
    (a, b) => idHash(a.puzzle.id) - idHash(b.puzzle.id) || a.puzzle.id.localeCompare(b.puzzle.id)
  );

  const counts = [0, 0, 0, 0];

  for (const [index, entry] of entries.entries()) {
    const killers = entry.puzzle.suspects.filter((suspect) => suspect.isKiller);
    if (killers.length !== 1) {
      throw new Error(`${entry.file}: expected exactly one killer, found ${killers.length}`);
    }
    const killer = killers[0] as Suspect;
    const innocent = entry.puzzle.suspects.filter((suspect) => !suspect.isKiller);
    const target = index % POSITION_COUNT;

    // Only reorder array entries; every suspect object and its fields stay intact.
    entry.puzzle.suspects = [
      ...innocent.slice(0, target),
      killer,
      ...innocent.slice(target),
    ];

    const reorderedKillers = entry.puzzle.suspects.filter((suspect) => suspect.isKiller);
    const originalIds = new Set(entry.puzzle.suspects.map((suspect) => suspect.id));
    if (
      reorderedKillers.length !== 1 ||
      reorderedKillers[0]?.id !== killer.id ||
      originalIds.size !== 4
    ) {
      throw new Error(`${entry.file}: rebalance lost a suspect or the killer field`);
    }

    counts[target] = (counts[target] ?? 0) + 1;
    await writeFile(
      path.join(PUZZLES_DIR, entry.file),
      `${JSON.stringify(entry.puzzle, null, indentOf(entry.raw))}\n`,
      'utf8'
    );
  }

  console.log(`Rebalanced ${entries.length} puzzles.`);
  counts.forEach((count, index) => {
    const percentage = ((count / entries.length) * 100).toFixed(1);
    console.log(`  position ${index + 1}: ${count} (${percentage}%)`);
  });
};

void main();
