import Phaser from 'phaser';
import { IntroScene } from './scenes/IntroScene';
import { TestimonyScene } from './scenes/TestimonyScene';
import { AccuseScene } from './scenes/AccuseScene';
import { ResultScene } from './scenes/ResultScene';
import { getPuzzleById } from '../../shared/puzzles';

export const startGame = (parent: string): Phaser.Game => {
  const puzzle = getPuzzleById('001');
  if (!puzzle) {
    throw new Error('Puzzle 001 not found');
  }

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#1b1f2a',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 360,
      height: 640,
    },
    scene: [
      new IntroScene(puzzle),
      new TestimonyScene(puzzle),
      new AccuseScene(puzzle),
      new ResultScene(puzzle),
    ],
  });
};
