import Phaser from 'phaser';
import { IntroScene } from './scenes/IntroScene';
import { TestimonyScene } from './scenes/TestimonyScene';
import { AccuseScene } from './scenes/AccuseScene';
import { CaseFileScene } from './scenes/CaseFileScene';
import { ResultScene } from './scenes/ResultScene';
import { CreditsScene } from './scenes/CreditsScene';
import { LeaderboardScene } from './scenes/LeaderboardScene';
import { fetchToday } from './api';
import type { PublicPuzzle } from '../../shared/types';
import type { GameState } from '../../shared/game';

export const applyTodayData = (
  game: Phaser.Game,
  puzzle: PublicPuzzle,
  state: GameState
): void => {
  for (const key of [
    'IntroScene',
    'TestimonyScene',
    'AccuseScene',
    'CaseFileScene',
    'ResultScene',
    'CreditsScene',
    'LeaderboardScene',
  ]) {
    if (game.scene.getScene(key)) {
      game.scene.remove(key);
    }
  }

  game.scene.add('IntroScene', new IntroScene(puzzle), false);
  game.scene.add('TestimonyScene', new TestimonyScene(puzzle), false);
  game.scene.add('AccuseScene', new AccuseScene(puzzle), false);
  game.scene.add('CaseFileScene', new CaseFileScene(), false);
  game.scene.add('ResultScene', new ResultScene(), false);
  game.scene.add('CreditsScene', new CreditsScene(), false);
  game.scene.add('LeaderboardScene', new LeaderboardScene(), false);

  if (state.finished) {
    game.scene.start('ResultScene', { puzzle, state });
  } else if (state.attemptsUsed > 0 || state.eliminatedIds.length > 0) {
    game.scene.start('AccuseScene', { puzzle, state });
  } else {
    game.scene.start('IntroScene', { puzzle, state });
  }
};

export const reloadToday = async (game: Phaser.Game): Promise<void> => {
  const data = await fetchToday();
  applyTodayData(game, data.puzzle, data.state);
};
