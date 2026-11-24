import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  getSuspectFirstName,
  SUSPECT_GENDERS,
} from '../src/shared/suspect-sprites';
import { validateScheduleJson } from '../src/shared/schedule';

type Suspect = {
  id?: unknown;
  name?: unknown;
  role?: unknown;
  color?: unknown;
  testimony?: unknown;
  alibiProof?: unknown;
  contradiction?: unknown;
  isKiller?: unknown;
};

type Puzzle = {
  id?: unknown;
  number?: unknown;
  title?: unknown;
  scene?: unknown;
  suspects?: unknown;
};

const PUZZLES_DIR = path.resolve(process.cwd(), 'src/shared/puzzles');
const SCHEDULE_PATH = path.resolve(process.cwd(), 'src/shared/schedule.json');
const MAX_TEXT = 160;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const addError = (errors: string[], message: string): void => {
  errors.push(message);
};

const validateText = (
  errors: string[],
  label: string,
  value: unknown,
  required = true
): void => {
  if (value == null) {
    if (required) addError(errors, `${label} is required and must be a non-empty string`);
    return;
  }
  if (typeof value !== 'string') {
    addError(errors, `${label} must be a string`);
    return;
  }
  if (value.trim().length === 0) {
    addError(errors, `${label} must be non-empty`);
    return;
  }
  if (value.length > MAX_TEXT) {
    addError(errors, `${label} must be under ${MAX_TEXT} characters (got ${value.length})`);
  }
};

const validatePuzzle = (file: string, puzzle: Puzzle): { errors: string[]; killerPosition?: number } => {
  const errors: string[] = [];

  validateText(errors, 'id', puzzle.id);
  if (typeof puzzle.number !== 'number' || !Number.isInteger(puzzle.number)) {
    addError(errors, 'number must be an integer');
  }
  validateText(errors, 'title', puzzle.title);
  validateText(errors, 'scene', puzzle.scene);
  if (typeof puzzle.scene === 'string' && puzzle.scene.includes('One of the four')) {
    addError(errors, 'scene must not contain "One of the four"');
  }

  if (!Array.isArray(puzzle.suspects)) {
    addError(errors, 'suspects must be an array of exactly 4 suspects');
    return { errors };
  }

  if (puzzle.suspects.length !== 4) {
    addError(errors, `suspects must have exactly 4 entries (got ${puzzle.suspects.length})`);
  }

  const suspectIds = new Set<string>();
  const killerIndices: number[] = [];

  puzzle.suspects.forEach((raw, index) => {
    const suspect = (raw ?? {}) as Suspect;
    const pos = index + 1;
    const prefix = `suspect[${pos}]`;

    if (!raw || typeof raw !== 'object') {
      addError(errors, `${prefix} must be an object`);
      return;
    }

    if (!isNonEmptyString(suspect.id)) {
      addError(errors, `${prefix}.id must be a non-empty string`);
    } else {
      if (suspectIds.has(suspect.id)) {
        addError(errors, `${prefix}.id "${suspect.id}" is duplicated within ${file}`);
      }
      suspectIds.add(suspect.id);
    }

    validateText(errors, `${prefix}.name`, suspect.name);
    if (isNonEmptyString(suspect.name)) {
      const firstName = getSuspectFirstName(suspect.name);
      if (!SUSPECT_GENDERS[firstName]) {
        addError(
          errors,
          `${prefix}.name first name "${firstName}" is missing from SUSPECT_GENDERS in src/shared/suspect-sprites.ts`
        );
      }
    }
    validateText(errors, `${prefix}.role`, suspect.role);
    validateText(errors, `${prefix}.testimony`, suspect.testimony);

    if (typeof suspect.color !== 'number' || !Number.isFinite(suspect.color)) {
      addError(errors, `${prefix}.color must be a number`);
    }

    if (typeof suspect.isKiller !== 'boolean') {
      addError(errors, `${prefix}.isKiller must be a boolean`);
      return;
    }

    if (suspect.isKiller) {
      killerIndices.push(index);
    }

    const hasAlibi = Object.prototype.hasOwnProperty.call(suspect, 'alibiProof');
    const hasContradiction = Object.prototype.hasOwnProperty.call(suspect, 'contradiction');

    if (suspect.isKiller) {
      validateText(errors, `${prefix}.contradiction`, suspect.contradiction);
      if (hasAlibi && suspect.alibiProof != null && suspect.alibiProof !== '') {
        addError(errors, `${prefix} is the killer and must not have alibiProof`);
      } else if (hasAlibi) {
        // explicit null/empty treated as present-but-invalid in spirit; keep simple
        addError(errors, `${prefix} is the killer and must not have alibiProof`);
      }
    } else {
      validateText(errors, `${prefix}.alibiProof`, suspect.alibiProof);
      if (hasContradiction && suspect.contradiction != null && suspect.contradiction !== '') {
        addError(errors, `${prefix} is innocent and must not have contradiction`);
      } else if (hasContradiction) {
        addError(errors, `${prefix} is innocent and must not have contradiction`);
      }
    }
  });

  if (puzzle.suspects.length > 0) {
    if (killerIndices.length === 0) {
      addError(errors, 'killer must match a suspect (exactly one suspect with isKiller=true)');
    } else if (killerIndices.length > 1) {
      addError(errors, `exactly one suspect must be the killer (found ${killerIndices.length})`);
    }
  }

  const killerIndex = killerIndices[0];
  return {
    errors,
    ...(killerIndex != null ? { killerPosition: killerIndex + 1 } : {}),
  };
};

const main = async (): Promise<void> => {
  let files: string[];
  try {
    files = (await readdir(PUZZLES_DIR))
      .filter((f) => f.endsWith('.json'))
      .sort();
  } catch (error) {
    console.error(`Failed to read puzzles directory: ${PUZZLES_DIR}`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
    return;
  }

  if (files.length === 0) {
    console.error('No puzzle JSON files found in src/shared/puzzles/');
    process.exit(1);
    return;
  }

  const globalPuzzleIds = new Map<string, string>();
  const nameOwners = new Map<string, Set<string>>();
  const perFileErrors = new Map<string, string[]>();
  const killerPositions: Array<{ file: string; position: number }> = [];
  let hasErrors = false;

  for (const file of files) {
    const fullPath = path.join(PUZZLES_DIR, file);
    const errors: string[] = [];

    let raw: string;
    try {
      raw = await readFile(fullPath, 'utf8');
    } catch (error) {
      errors.push(`could not read file: ${error instanceof Error ? error.message : String(error)}`);
      perFileErrors.set(file, errors);
      hasErrors = true;
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      errors.push(`invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
      perFileErrors.set(file, errors);
      hasErrors = true;
      continue;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      errors.push('puzzle must be a JSON object');
      perFileErrors.set(file, errors);
      hasErrors = true;
      continue;
    }

    const puzzle = parsed as Puzzle;
    if (isNonEmptyString(puzzle.id)) {
      const existing = globalPuzzleIds.get(puzzle.id);
      if (existing) {
        errors.push(`puzzle id "${puzzle.id}" is not unique (also in ${existing})`);
      } else {
        globalPuzzleIds.set(puzzle.id, file);
      }
    }

    const result = validatePuzzle(file, puzzle);
    errors.push(...result.errors);
    if (result.killerPosition != null) {
      killerPositions.push({ file, position: result.killerPosition });
    }
    if (Array.isArray(puzzle.suspects)) {
      for (const raw of puzzle.suspects) {
        const suspect = (raw ?? {}) as Suspect;
        if (isNonEmptyString(suspect.name)) {
          const owners = nameOwners.get(suspect.name) ?? new Set<string>();
          owners.add(file);
          nameOwners.set(suspect.name, owners);
        }
      }
    }

    perFileErrors.set(file, errors);
    if (errors.length > 0) {
      hasErrors = true;
    }
  }

  for (const [name, owners] of nameOwners.entries()) {
    if (owners.size <= 1) {
      continue;
    }
    const filesWithName = [...owners].sort().join(', ');
    for (const file of owners) {
      const errors = perFileErrors.get(file) ?? [];
      errors.push(
        `suspect name "${name}" is used in more than one puzzle (${filesWithName})`
      );
      perFileErrors.set(file, errors);
      hasErrors = true;
    }
  }

  for (const file of files) {
    const errors = perFileErrors.get(file) ?? [];
    const pos = killerPositions.find((k) => k.file === file)?.position;
    if (errors.length === 0) {
      const posText = pos != null ? `, killer position: ${pos}` : '';
      console.log(`OK  ${file}${posText}`);
    } else {
      console.log(`ERR ${file}`);
      for (const err of errors) {
        console.log(`  - ${err}`);
      }
      if (pos != null) {
        console.log(`  - killer position: ${pos}`);
      }
    }
  }

  // Position distribution must stay balanced across the whole puzzle set.
  if (killerPositions.length > 0) {
    const counts = new Map<number, number>();
    for (const { position } of killerPositions) {
      counts.set(position, (counts.get(position) ?? 0) + 1);
    }
    for (const [position, count] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
      const ratio = count / killerPositions.length;
      if (ratio > 0.35) {
        const pct = Math.round(ratio * 100);
        console.error(
          `ERROR: killer position ${position} appears ${count}/${killerPositions.length} times (${pct}% > 35%)`
        );
        hasErrors = true;
      }
    }
  }

  // Validate src/shared/schedule.json against the known puzzle ids.
  try {
    const rawSchedule = await readFile(SCHEDULE_PATH, 'utf8');
    const scheduleResult = validateScheduleJson(rawSchedule, new Set(globalPuzzleIds.keys()));
    if (scheduleResult.errors.length === 0) {
      console.log(`OK  schedule.json (${scheduleResult.entryCount} scheduled)`);
    } else {
      console.log('ERR schedule.json');
      for (const err of scheduleResult.errors) {
        console.log(`  - ${err}`);
      }
      hasErrors = true;
    }
  } catch (error) {
    console.log('ERR schedule.json');
    console.log(
      `  - could not read file: ${error instanceof Error ? error.message : String(error)}`
    );
    hasErrors = true;
  }

  if (hasErrors) {
    process.exit(1);
  }
};

void main();
