import Phaser from 'phaser';
import { hashString } from '../assets';

// Small fixed palette for the interrogation room. All shapes use hard edges only
// (no gradients, no blur) so the room reads as pixel art next to the LPC sprites.
export const ROOM_PALETTE = {
  wall: 0x3b4257,
  wallPanel: 0x32384c,
  floor: 0x242a3c,
  floorLine: 0x1a1f2e,
  frame: 0x1b2133,
  sky: 0x142545,
  moon: 0xf4f1de,
  star: 0xc9d1e1,
  cord: 0x1a1f2e,
  shade: 0xd9a441,
  bulb: 0xfff3c4,
  cone: 0xf2cc8f,
} as const;

const TINTS = [0x81b29a, 0xe07a5f, 0x9b8cd8] as const;

export const getPuzzleTint = (puzzleId: string): number =>
  TINTS[hashString(puzzleId) % TINTS.length] ?? TINTS[0];

type BackdropOptions = {
  simple?: boolean;
};

/**
 * Draws the reusable interrogation-room backdrop into a scene. Call this first in
 * create() so every other game object renders on top of it.
 */
export const createInterrogationBackdrop = (
  scene: Phaser.Scene,
  puzzleId: string,
  options: BackdropOptions = {}
): void => {
  const { width, height } = scene.scale;
  const floorY = 500;
  const tint = getPuzzleTint(puzzleId);

  // Wall + vertical panel seams.
  scene.add.rectangle(0, 0, width, floorY, ROOM_PALETTE.wall).setOrigin(0, 0);
  for (let x = 46; x < width; x += 64) {
    scene.add.rectangle(x, 0, 2, floorY, ROOM_PALETTE.wallPanel).setOrigin(0, 0);
  }

  // Darker floor strip with a simple plank pattern.
  scene.add.rectangle(0, floorY, width, height - floorY, ROOM_PALETTE.floor).setOrigin(0, 0);
  for (let y = floorY + 16; y < height; y += 16) {
    scene.add.rectangle(0, y, width, 2, ROOM_PALETTE.floorLine).setOrigin(0, 0);
  }
  for (let i = 0; i < 4; i += 1) {
    const seamX = 40 + i * 90;
    const seamY = floorY + 8 + (i % 2) * 16;
    scene.add.rectangle(seamX, seamY, 2, 24, ROOM_PALETTE.floorLine).setOrigin(0, 0);
  }

  // Subtle per-puzzle tint over the room shell.
  scene.add.rectangle(0, 0, width, height, tint, 0.05).setOrigin(0, 0);

  if (options.simple) {
    return;
  }

  // Window with a night-blue sky (right side, above the floor).
  const wx = 280;
  const wy = 42;
  const ww = 72;
  const wh = 58;
  scene.add.rectangle(wx, wy, ww, wh, ROOM_PALETTE.frame).setOrigin(0, 0);
  scene.add.rectangle(wx + 4, wy + 4, ww - 8, wh - 8, ROOM_PALETTE.sky).setOrigin(0, 0);
  scene.add.rectangle(wx + 46, wy + 10, 10, 10, ROOM_PALETTE.moon).setOrigin(0, 0);
  scene.add.rectangle(wx + 12, wy + 14, 3, 3, ROOM_PALETTE.star).setOrigin(0, 0);
  scene.add.rectangle(wx + 30, wy + 30, 2, 2, ROOM_PALETTE.star).setOrigin(0, 0);
  scene.add.rectangle(wx + 16, wy + 42, 2, 2, ROOM_PALETTE.star).setOrigin(0, 0);
  scene.add.rectangle(wx + ww / 2 - 2, wy + 4, 4, wh - 8, ROOM_PALETTE.frame).setOrigin(0, 0);
  scene.add.rectangle(wx + 4, wy + wh / 2 - 2, ww - 8, 4, ROOM_PALETTE.frame).setOrigin(0, 0);

  // Hanging lamp on the left so centre-top counters stay readable.
  const lx = 72;
  scene.add.rectangle(lx - 1, 0, 2, 36, ROOM_PALETTE.cord).setOrigin(0, 0);
  scene.add.rectangle(lx - 18, 36, 36, 10, ROOM_PALETTE.shade).setOrigin(0, 0);
  scene.add.rectangle(lx - 12, 46, 24, 6, ROOM_PALETTE.shade).setOrigin(0, 0);
  scene.add.rectangle(lx - 5, 52, 10, 8, ROOM_PALETTE.bulb).setOrigin(0, 0);

  // Hard-edged light cone (no gradient/blur), behind every other object.
  scene.add.triangle(
    lx,
    60,
    0,
    0,
    -96,
    floorY - 60,
    96,
    floorY - 60,
    ROOM_PALETTE.cone,
    0.1
  );
};
