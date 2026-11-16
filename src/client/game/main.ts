import Phaser from 'phaser';
import { fetchToday } from './api';
import { PreloadScene } from './scenes/PreloadScene';
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

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: parentId,
    backgroundColor: '#1b1f2a',
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      autoRound: true,
      width: 360,
      height: 640,
    },
    scene: [new PreloadScene()],
  });

  game.scene.start('PreloadScene', data);

  return game;
};
