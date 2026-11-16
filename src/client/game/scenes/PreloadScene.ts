import Phaser from 'phaser';
import { CHARACTER_ASSETS, DETECTIVE_ASSET } from '../assets';
import { applyTodayData } from '../reload';
import type { PublicPuzzle } from '../../../shared/types';
import type { GameState } from '../../../shared/game';

export type PreloadData = {
  puzzle: PublicPuzzle;
  state: GameState;
};

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  public preload(): void {
    // Tolerate missing files: log and continue so fallback rectangles are used.
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      // eslint-disable-next-line no-console
      console.warn(`Asset failed to load (using fallback): ${file?.key ?? 'unknown'}`);
    });

    for (const asset of CHARACTER_ASSETS) {
      this.load.image(asset.key, asset.path);
    }
    this.load.image(DETECTIVE_ASSET.key, DETECTIVE_ASSET.path);
  }

  public create(data: PreloadData): void {
    applyTodayData(this.game, data.puzzle, data.state);
  }
};
