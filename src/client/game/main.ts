import Phaser from 'phaser';
import { IntroScene } from './scenes/IntroScene';
import { TestimonyScene } from './scenes/TestimonyScene';
import { AccuseScene } from './scenes/AccuseScene';
import { ResultScene } from './scenes/ResultScene';
import { fetchToday } from './api';
import type { PublicPuzzle } from '../../shared/types';
import type { GameState } from '../../shared/game';

export type GameBootData = {
  puzzle: PublicPuzzle;
  state: GameState;
};

const showBootError = (parent: HTMLElement, message: string): void => {
  parent.innerHTML = '';
  const el = document.createElement('div');
  el.style.cssText =
    'display:flex;align-items:center;justify-content:center;height:100%;padding:24px;color:#f4f1de;font-family:monospace;text-align:center;background:#1b1f2a;';
  el.textContent = message;
  parent.appendChild(el);
};

export const startGame = async (parentId: string): Promise<Phaser.Game | void> => {
  const parent = document.getElementById(parentId);
  if (!parent) {
    throw new Error('Missing game container');
  }

  let data: GameBootData;
  try {
    data = await fetchToday();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load puzzle';
    showBootError(parent, `Could not load today's puzzle.\n${message}`);
    return;
  }

  const { puzzle, state } = data;

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: parentId,
    backgroundColor: '#1b1f2a',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 360,
      height: 640,
    },
  });

  game.scene.add('IntroScene', new IntroScene(puzzle));
  game.scene.add('TestimonyScene', new TestimonyScene(puzzle));
  game.scene.add('AccuseScene', new AccuseScene(puzzle));
  game.scene.add('ResultScene', new ResultScene());

  if (state.finished) {
    game.scene.start('ResultScene', { state });
  } else {
    game.scene.start('IntroScene', { state });
  }

  return game;
};
