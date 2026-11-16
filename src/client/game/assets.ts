export const CHARACTER_KEYS = Array.from({ length: 10 }, (_, i) => {
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

const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

export const getSuspectSpriteKey = (puzzleId: string, suspectIndex: number): string => {
  const base = hashString(puzzleId) % CHARACTER_KEYS.length;
  const keyIndex = (base + suspectIndex) % CHARACTER_KEYS.length;
  return CHARACTER_KEYS[keyIndex] ?? CHARACTER_KEYS[0]!;
};
