import {
  getSpriteKeysForGender,
  getSuspectGender,
} from '../../shared/suspect-sprites';

export const CHARACTER_KEYS = Array.from({ length: 22 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return `char_${n}`;
});

export const DETECTIVE_KEY = 'detective';

export type CharacterAsset = {
  key: string;
  path: string;
};

export const CHARACTER_ASSETS: CharacterAsset[] = CHARACTER_KEYS.map((key) => ({
  key,
  path: `assets/characters/${key}.png`,
}));

export const DETECTIVE_ASSET: CharacterAsset = {
  key: DETECTIVE_KEY,
  path: 'assets/detective.png',
};

export const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

/**
 * Gender-matched, deterministic sprite for one suspect.
 *
 * The gender comes from the explicit first-name map in shared/suspect-sprites.ts;
 * the sprite is chosen from that gender's pool (from art-source/sprites.json) by
 * puzzle id + suspect index. Each pool has 11 sprites and a puzzle has 4
 * suspects, so distinct indices always give distinct sprites in one puzzle.
 * Only an unmapped name falls back to the old hash-based choice.
 */
export const getSuspectSpriteKey = (
  puzzleId: string,
  suspectIndex: number,
  suspectName?: string
): string => {
  const gender = suspectName ? getSuspectGender(suspectName) : undefined;
  if (gender) {
    const pool = getSpriteKeysForGender(gender);
    const key = pool[(hashString(puzzleId) + suspectIndex) % pool.length];
    if (key) return key;
  }

  const base = hashString(puzzleId) % CHARACTER_KEYS.length;
  return CHARACTER_KEYS[(base + suspectIndex) % CHARACTER_KEYS.length] ?? CHARACTER_KEYS[0]!;
};
